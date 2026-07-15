'use client'

import { useEffect, useRef } from 'react'
import { useDashboardState } from './useDashboardState'

// ─────────────────────────────────────────────────────────────────────────────
// useMarketEngine — always-on dual-source market data engine.
//
// Priority 1: Kyma FastAPI backend WebSocket (full AI pipeline)
// Priority 2: Binance public WebSocket (live price only — no AI)
//
// This means the chart is ALWAYS live even when the backend is offline,
// which is critical for judge demos at the OKX hackathon.
// ─────────────────────────────────────────────────────────────────────────────

// Map market symbol to Binance stream name
function toBinanceStream(symbol: string, timeframe: string): string {
  const s = symbol.toLowerCase()  // BTCUSDT → btcusdt
  const tf = timeframe === '1d' ? '1d' : timeframe  // passthrough
  return `${s}@kline_${tf}`
}

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
    terminate,
  } = useDashboardState()

  const backendWsRef   = useRef<WebSocket | null>(null)
  const binanceWsRef   = useRef<WebSocket | null>(null)
  const backendAlive   = useRef(false)
  const marketRef      = useRef(selectedMarket)
  const timeframeRef   = useRef(selectedTimeframe)

  useEffect(() => { marketRef.current = selectedMarket },   [selectedMarket])
  useEffect(() => { timeframeRef.current = selectedTimeframe }, [selectedTimeframe])

  // ── 1. Backend WebSocket (Kyma AI pipeline) ───────────────────────────────
  useEffect(() => {
    const wsUrl = process.env.NEXT_PUBLIC_WS_URL || 'ws://localhost:8000/ws'
    let reconnectTimer: ReturnType<typeof setTimeout>

    function connect() {
      const ws = new WebSocket(wsUrl)
      backendWsRef.current = ws

      ws.onopen = () => {
        backendAlive.current = true
        console.log('[Kyma] Backend connected')
        subscribeMarket(ws, marketRef.current, timeframeRef.current)
      }

      ws.onmessage = (event) => {
        try {
          const payload = JSON.parse(event.data)
          const data = payload.data
          switch (payload.event) {
            case 'historical_candles':
              if (data.symbol === marketRef.current) setHistoricalCandles(data.candles)
              break
            case 'market_tick':
              if (data.symbol === marketRef.current) pushTick(data.price)
              break
            case 'agent_log':
              pushLog(data)
              break
            case 'smc_pattern_detected':
              pushOrderBlock({ priceLevel: data.priceLevel, direction: data.direction, asset: data.asset, createdAt: Date.now() })
              break
            case 'trade_execution':
              openPosition({
                tradeId: data.tradeId, symbol: data.symbol, side: data.side,
                sizeUsdt: data.sizeUsdt, qty: (data.sizeUsdt * data.leverage) / data.entryPrice,
                leverage: data.leverage, entryPrice: data.entryPrice, stopLoss: data.stopLoss,
                takeProfit: data.takeProfit, liqPrice: 0, riskTier: 'BASE', markPrice: data.entryPrice, pnl: 0,
              })
              break
            case 'profit_target_hit':
              terminate()
              break
            case 'portfolio_update':
              break
          }
        } catch (e) { console.error('[Kyma] WS parse error:', e) }
      }

      ws.onerror = () => { backendAlive.current = false }
      ws.onclose = () => {
        backendAlive.current = false
        console.log('[Kyma] Backend disconnected — Binance fallback active')
        // Retry backend every 10 seconds
        reconnectTimer = setTimeout(connect, 10_000)
      }
    }

    connect()
    return () => {
      clearTimeout(reconnectTimer)
      backendWsRef.current?.close()
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ── 2. Binance Public WebSocket fallback ──────────────────────────────────
  // Always connects and streams live kline data. Provides live price ticks
  // when the backend is offline — judges always see a moving chart.
  useEffect(() => {
    let ws: WebSocket

    function connectBinance(symbol: string, timeframe: string) {
      binanceWsRef.current?.close()
      const stream = toBinanceStream(symbol, timeframe)
      ws = new WebSocket(`wss://stream.binance.com:9443/ws/${stream}`)
      binanceWsRef.current = ws

      ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data)
          if (msg.e === 'kline') {
            const k = msg.k
            // Only push tick from Binance if backend is not providing it
            if (!backendAlive.current) {
              pushTick(parseFloat(k.c))  // k.c = close price (current)
            }
          }
        } catch { /* ignore */ }
      }

      ws.onerror = (e) => console.warn('[Binance WS] error:', e)
    }

    connectBinance(selectedMarket, selectedTimeframe)

    return () => {
      ws?.close()
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedMarket, selectedTimeframe])

  // ── Re-subscribe backend when market or timeframe changes ─────────────────
  useEffect(() => {
    const ws = backendWsRef.current
    if (!ws || ws.readyState !== WebSocket.OPEN) return
    subscribeMarket(ws, selectedMarket, selectedTimeframe)
  }, [selectedMarket, selectedTimeframe])

  // Re-subscribe on reset
  useEffect(() => {
    const ws = backendWsRef.current
    if (!ws || ws.readyState !== WebSocket.OPEN) return
    subscribeMarket(ws, marketRef.current, timeframeRef.current)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resetNonce])
}

function subscribeMarket(ws: WebSocket, symbol: string, timeframe: string) {
  if (ws.readyState !== WebSocket.OPEN) return
  ws.send(JSON.stringify({ action: 'subscribe_market', symbol, timeframe }))
}
