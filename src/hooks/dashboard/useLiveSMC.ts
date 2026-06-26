'use client'

import { useEffect, useRef } from 'react'
import { useDashboardState, type LogType } from './useDashboardState'
import type { SMCResponse } from '@/lib/smcPrompt'

// ─────────────────────────────────────────────────────────────────────────
// useLiveSMC — replaces the mock engine's random SMC strings with a real
// LLM call. Polls /api/smc every POLL_INTERVAL_MS while the agent is active.
//
// Inputs to the model: current price + a sliding window of the last N ticks.
// Outputs are dispatched into the store via pushLog and pushOrderBlock so
// the existing dashboard panels (ReasoningTerminal, SMCChart) light up
// without any component changes.
//
// Failure mode: if the API errors or times out, we log a single WARNING
// line and back off — the price tick loop in useMockEngine keeps the UI
// alive so judges never see a frozen screen.
// ─────────────────────────────────────────────────────────────────────────

// Qwen3.6 is a thinking model — measured 16–25s per SMC call. Polling
// faster than that just queues up requests behind the in-flight guard,
// so we tune the interval to match real latency. The mock engine still
// fires PERC/RISK/EXEC lines at ~1.6s, so the terminal never feels dead.
const POLL_INTERVAL_MS = 15_000
const HISTORY_LENGTH = 60        // ~60s of 1Hz ticks
const ERROR_BACKOFF_MS = 30_000  // slow down after a failure

function hhmmss(d = new Date()) {
  const p = (n: number) => String(n).padStart(2, '0')
  return `${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`
}

export function useLiveSMC() {
  const { lifecycle, currentPrice, pushLog, pushOrderBlock } = useDashboardState()

  // Rolling tick history — kept outside React state to avoid re-render
  // pressure (we already re-render on every TICK from the mock engine).
  const historyRef = useRef<number[]>([])
  const lastErrorAtRef = useRef<number>(0)
  const inFlightRef = useRef<boolean>(false)

  useEffect(() => {
    if (currentPrice <= 0) return
    const h = historyRef.current
    h.push(currentPrice)
    if (h.length > HISTORY_LENGTH) h.shift()
  }, [currentPrice])

  useEffect(() => {
    if (lifecycle !== 'active') return

    // Reset history when a fresh session begins so we don't carry stale
    // ticks from a previous deploy.
    historyRef.current = []
    lastErrorAtRef.current = 0

    let cancelled = false

    const runOnce = async () => {
      if (cancelled) return
      if (inFlightRef.current) return
      if (historyRef.current.length < 5) return  // wait for enough context

      // Back off after recent errors so we don't spam a broken endpoint.
      if (Date.now() - lastErrorAtRef.current < ERROR_BACKOFF_MS) return

      inFlightRef.current = true
      try {
        const res = await fetch('/api/smc', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            price: historyRef.current[historyRef.current.length - 1],
            recent: historyRef.current,
          }),
        })

        if (!res.ok) {
          const { error } = (await res.json().catch(() => ({ error: res.statusText }))) as {
            error?: string
          }
          throw new Error(error || `HTTP ${res.status}`)
        }

        const data = (await res.json()) as SMCResponse
        if (cancelled) return

        const type: LogType =
          data.confidence >= 0.75
            ? 'SUCCESS'
            : data.confidence >= 0.5
              ? 'INFO'
              : 'WARNING'

        pushLog({
          time: hhmmss(),
          module: data.module || 'SMC',
          message: `${data.marketStructure} · ${data.bias} · conf ${(data.confidence * 100).toFixed(0)}% — ${data.reasoning}`,
          type,
        })

        if (
          data.orderBlock &&
          Number.isFinite(data.orderBlock.priceLevel) &&
          data.confidence >= 0.5
        ) {
          pushOrderBlock({
            priceLevel: data.orderBlock.priceLevel,
            direction: data.orderBlock.direction,
            asset: 'BTCUSDT',
            createdAt: Date.now(),
          })
        }
      } catch (err) {
        if (cancelled) return
        lastErrorAtRef.current = Date.now()
        pushLog({
          time: hhmmss(),
          module: 'PERC',
          message: `LLM unreachable · ${err instanceof Error ? err.message : 'unknown'} · backing off`,
          type: 'WARNING',
        })
      } finally {
        inFlightRef.current = false
      }
    }

    // Fire one immediately once we have enough history, then on interval.
    const kickoff = setTimeout(runOnce, 2_000)
    const timer = setInterval(runOnce, POLL_INTERVAL_MS)

    return () => {
      cancelled = true
      clearTimeout(kickoff)
      clearInterval(timer)
    }
  }, [lifecycle, pushLog, pushOrderBlock])
}
