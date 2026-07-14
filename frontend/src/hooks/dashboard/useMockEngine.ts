'use client'

import { useEffect, useRef } from 'react'
import { useDashboardState } from './useDashboardState'

// ─────────────────────────────────────────────────────────────────────────────
// useMarketEngine — always-on WebSocket bridge to the Kyma FastAPI backend.
//
// - Connects immediately on dashboard mount (no need to Deploy first).
// - Whenever selectedMarket or selectedTimeframe changes, sends a
//   subscribe_market payload so the backend fetches & streams real OHLCV
//   candles for the new pair/timeframe.
// - Live market_tick events keep the current candle updated in real-time.
// - When the agent is Deployed (lifecycle === 'active'), additional events
//   flow through: agent_log, smc_pattern_detected, trade_execution.
// ─────────────────────────────────────────────────────────────────────────────

export function useMockEngine() {
  const {
    lifecycle,
    resetNonce,
    selectedMarket,
    selectedTimeframe,
    pushTick,
    pushLog,
    pushOrderBlock,
    openPosition,
    setHistoricalCandles,
  } = useDashboardState()

  const wsRef = useRef<WebSocket | null>(null)
  const marketRef = useRef(selectedMarket)
  const timeframeRef = useRef(selectedTimeframe)
  const connectedRef = useRef(false)

  // Keep refs fresh so WebSocket handlers read the latest values without
  // needing to re-bind (which would drop the connection).
  useEffect(() => { marketRef.current = selectedMarket }, [selectedMarket])
  useEffect(() => { timeframeRef.current = selectedTimeframe }, [selectedTimeframe])

  // ── Persistent WebSocket connection ───────────────────────────────────────
  // Opens once on mount and stays open. Only closes if the component unmounts.
  useEffect(() => {
    const wsUrl = process.env.NEXT_PUBLIC_WS_URL || 'ws://localhost:8000/ws'
    const ws = new WebSocket(wsUrl)
    wsRef.current = ws

    ws.onopen = () => {
      connectedRef.current = true
      console.log('[Kyma] Connected to backend')
      // Immediately request historical candles for the default market
      subscribeToMarket(ws, marketRef.current, timeframeRef.current)
    }

    ws.onmessage = (event) => {
      try {
        const payload = JSON.parse(event.data)
        const data = payload.data

        switch (payload.event) {
          // Real historical candles — replace chart history entirely
          case 'historical_candles':
            if (data.symbol === marketRef.current) {
              setHistoricalCandles(data.candles)
            }
            break

          // Live tick — only pass through if it matches the viewed market
          case 'market_tick':
            if (data.symbol === marketRef.current) {
              pushTick(data.price)
            }
            break

          // Agent intelligence events (flow when lifecycle === 'active')
          case 'agent_log':
            pushLog(data)
            break

          case 'smc_pattern_detected':
            pushOrderBlock({
              priceLevel: data.priceLevel,
              direction: data.direction,
              asset: data.asset,
              createdAt: Date.now(),
            })
            break

          case 'trade_execution':
            openPosition({
              tradeId: data.tradeId,
              symbol: data.symbol,
              side: data.side,
              sizeUsdt: data.sizeUsdt,
              qty: (data.sizeUsdt * data.leverage) / data.entryPrice,
              leverage: data.leverage,
              entryPrice: data.entryPrice,
              stopLoss: data.stopLoss,
              takeProfit: data.takeProfit,
              liqPrice: 0,
              riskTier: 'BASE',
              markPrice: data.entryPrice,
              pnl: 0,
            })
            break
        }
      } catch (e) {
        console.error('[Kyma] WS parse error:', e)
      }
    }

    ws.onerror = (err) => console.error('[Kyma] WS error:', err)

    ws.onclose = () => {
      connectedRef.current = false
      console.log('[Kyma] WS disconnected')
    }

    return () => {
      ws.close()
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ── Re-subscribe when market or timeframe changes ─────────────────────────
  // Fires whenever the user picks a new pair or timeframe from the sidebar.
  useEffect(() => {
    const ws = wsRef.current
    if (!ws || ws.readyState !== WebSocket.OPEN) return
    subscribeToMarket(ws, selectedMarket, selectedTimeframe)
  }, [selectedMarket, selectedTimeframe])

  // Also re-subscribe on reset so the chart clears and reloads
  useEffect(() => {
    const ws = wsRef.current
    if (!ws || ws.readyState !== WebSocket.OPEN) return
    subscribeToMarket(ws, marketRef.current, timeframeRef.current)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resetNonce])
}

function subscribeToMarket(ws: WebSocket, symbol: string, timeframe: string) {
  if (ws.readyState !== WebSocket.OPEN) return
  ws.send(JSON.stringify({
    action: 'subscribe_market',
    symbol,
    timeframe,
  }))
  console.log(`[Kyma] Subscribed to ${symbol} @ ${timeframe}`)
}
