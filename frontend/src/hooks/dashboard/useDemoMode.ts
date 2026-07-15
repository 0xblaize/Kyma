'use client'

import { useCallback } from 'react'
import { useDashboardState } from '@/hooks/dashboard/useDashboardState'
import type { LogModule, LogType } from '@/hooks/dashboard/useDashboardState'

// ─── Demo log sequence ──────────────────────────────────────────────────────
// Each entry is injected 600 ms after the previous one so the terminal reads
// like a live analysis rather than an instantaneous dump.

interface DemoLog {
  module: LogModule
  message: string
  type: LogType
}

const DEMO_LOGS: DemoLog[] = [
  {
    module: 'PERC',
    message: 'Fetching 15m + 4h candles for BTCUSDT\u2026',
    type: 'INFO',
  },
  {
    module: 'SMC',
    message: '15m \u2192 UPTREND | BOS: BULLISH_BOS | Zone: DISCOUNT | RSI: 58.4',
    type: 'INFO',
  },
  {
    module: 'SMC',
    message: '4h \u2192 UPTREND | BOS: None | Zone: EQUILIBRIUM | EMA: BULLISH',
    type: 'INFO',
  },
  {
    module: 'RISK',
    message: '\u2713 Confluence confirmed: BULLISH on both 15m and 4h',
    type: 'INFO',
  },
  {
    module: 'SMC',
    message: 'FVG detected: BULLISH_FVG gap 41820.5\u201341795.0',
    type: 'INFO',
  },
  {
    module: 'SMC',
    message: 'Order Block: BULLISH_OB zone 41750.0\u201341800.0',
    type: 'INFO',
  },
  {
    module: 'SMC',
    message: 'AI analyst: EMA bias bullish, price retesting OB in discount zone',
    type: 'INFO',
  },
  {
    module: 'SMC',
    message: 'RSI 58.4 \u2014 bullish momentum, not overbought',
    type: 'INFO',
  },
  {
    module: 'SMC',
    message: 'Price swept equal lows at 41780 \u2014 liquidity grab before pump',
    type: 'INFO',
  },
  {
    module: 'RISK',
    message: '[Qwen] Decision: LONG | Confidence: 8/10 | R:R 2.5:1',
    type: 'SUCCESS',
  },
  {
    module: 'RISK',
    message: 'Policy passed: BULLISH BTCUSDT | R:R 2.50 | Size $500 | 10x lev',
    type: 'SUCCESS',
  },
  {
    module: 'EXEC',
    message:
      '\u2713 Trade demo_001 opened: LONG BTCUSDT @ $41850.00 | SL $41225.00 | TP $43400.00 | 10x',
    type: 'SUCCESS',
  },
]

// Final position opens slightly after the last log settles.
const DEMO_POSITION_DELAY_MS = DEMO_LOGS.length * 600 + 200

function nowHHMMSS(): string {
  return new Date().toTimeString().slice(0, 8)
}

// ─── Hook ────────────────────────────────────────────────────────────────────

export function useDemoMode() {
  const { lifecycle, deployAgent, pushLog, openPosition } = useDashboardState()

  const launchDemo = useCallback(() => {
    // Guard: only works from idle. The button is already hidden otherwise, but
    // this prevents race conditions if the state updates mid-render.
    if (lifecycle !== 'idle') return

    // 1. Transition the agent to active state (equivalent to pressing Deploy).
    deployAgent()

    // 2. Drip-feed the demo log sequence at 600 ms intervals.
    DEMO_LOGS.forEach((entry, i) => {
      setTimeout(() => {
        pushLog({
          time: nowHHMMSS(),
          module: entry.module,
          message: entry.message,
          type: entry.type,
        })
      }, (i + 1) * 600)
    })

    // 3. After the last log has appeared, open a fake position so the
    //    PositionsLedger renders a live demo trade.
    setTimeout(() => {
      openPosition({
        tradeId: 'demo_001',
        symbol: 'BTCUSDT',
        side: 'LONG',
        sizeUsdt: 500,
        qty: 0.1194,
        leverage: 10,
        entryPrice: 41850,
        stopLoss: 41225,
        takeProfit: 43400,
        liqPrice: 37800,
        riskTier: 'BASE',
        markPrice: 41850,
        pnl: 0,
      })
    }, DEMO_POSITION_DELAY_MS)
  }, [lifecycle, deployAgent, pushLog, openPosition])

  return { launchDemo }
}
