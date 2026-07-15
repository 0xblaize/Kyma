'use client'

import { useEffect, useRef, useState } from 'react'
import {
  CandlestickSeries,
  ColorType,
  CrosshairMode,
  LineStyle,
  createChart,
  type CandlestickData,
  type IChartApi,
  type IPriceLine,
  type ISeriesApi,
  type UTCTimestamp,
} from 'lightweight-charts'
import { useDashboardState } from '@/hooks/dashboard/useDashboardState'

// ─────────────────────────────────────────────────────────────────────────────
// SMCChart — always-live TradingView-style candlestick chart.
//
// Historical candles are fetched from the real exchange (via FastAPI + CCXT)
// whenever the user changes the market or timeframe. The current candle is
// kept live via WebSocket ticks from the backend's market_router.
// ─────────────────────────────────────────────────────────────────────────────

// Timeframe → seconds per candle, used to bucket incoming ticks.
const TF_SECONDS: Record<string, number> = {
  '1m': 60, '3m': 180, '5m': 300, '15m': 900, '30m': 1800,
  '1h': 3600, '2h': 7200, '4h': 14400, '6h': 21600, '12h': 43200, '1d': 86400,
}

const TIMEFRAMES = ['1m', '5m', '15m', '30m', '1h', '2h', '4h', '1d']

function nowBucket(tfSeconds: number): UTCTimestamp {
  return (Math.floor(Date.now() / 1000 / tfSeconds) * tfSeconds) as UTCTimestamp
}

export default function SMCChart() {
  const containerRef = useRef<HTMLDivElement>(null)
  const chartRef = useRef<IChartApi | null>(null)
  const seriesRef = useRef<ISeriesApi<'Candlestick'> | null>(null)
  const lastCandleRef = useRef<CandlestickData | null>(null)
  const priceLinesRef = useRef<Map<number, IPriceLine>>(new Map())

  const {
    currentPrice,
    activeOrderBlocks,
    selectedMarket,
    selectedTimeframe,
    setSelectedMarket,
    setSelectedTimeframe,
    historicalCandles,
  } = useDashboardState()

  // ── Chart construction — runs once ────────────────────────────────────────
  useEffect(() => {
    const el = containerRef.current
    if (!el) return

    const chart = createChart(el, {
      width: el.clientWidth,
      height: el.clientHeight,
      layout: {
        background: { type: ColorType.Solid, color: 'transparent' },
        textColor: '#71717a',
        fontFamily: 'JetBrains Mono, ui-monospace, monospace',
        fontSize: 10,
      },
      grid: {
        vertLines: { visible: false },
        horzLines: { color: '#27272a' },
      },
      rightPriceScale: { borderColor: '#27272a' },
      timeScale: { borderColor: '#27272a', timeVisible: true, secondsVisible: false },
      crosshair: { mode: CrosshairMode.Normal },
    })

    const series = chart.addSeries(CandlestickSeries, {
      upColor: '#10b981',
      downColor: '#f43f5e',
      wickUpColor: '#10b981',
      wickDownColor: '#f43f5e',
      borderVisible: false,
    })

    chartRef.current = chart
    seriesRef.current = series

    const ro = new ResizeObserver(() => {
      chart.applyOptions({ width: el.clientWidth, height: el.clientHeight })
    })
    ro.observe(el)

    return () => {
      ro.disconnect()
      priceLinesRef.current.clear()
      chart.remove()
      chartRef.current = null
      seriesRef.current = null
    }
  }, [])

  // ── Load real historical candles from the backend ─────────────────────────
  // Triggers whenever the state store receives a historical_candles event
  // (i.e. whenever market or timeframe changes via subscribe_market).
  useEffect(() => {
    const series = seriesRef.current
    const chart = chartRef.current
    if (!series || !chart || historicalCandles.length === 0) return

    // Clear order-block price lines — they're stale on market change.
    for (const line of priceLinesRef.current.values()) series.removePriceLine(line)
    priceLinesRef.current.clear()

    const data: CandlestickData[] = historicalCandles.map((c) => ({
      time: c.time as UTCTimestamp,
      open: c.open,
      high: c.high,
      low: c.low,
      close: c.close,
    }))

    series.setData(data)
    lastCandleRef.current = data[data.length - 1] ?? null
    chart.timeScale().fitContent()
  }, [historicalCandles])

  // ── Live tick — update the current candle in real-time ────────────────────
  useEffect(() => {
    const series = seriesRef.current
    if (!series || currentPrice <= 0) return

    const tfSeconds = TF_SECONDS[selectedTimeframe] ?? 3600
    const bucket = nowBucket(tfSeconds)
    const last = lastCandleRef.current

    if (!last || last.time !== bucket) {
      // New candle: open at the prior close
      const open = last ? last.close : currentPrice
      const next: CandlestickData = {
        time: bucket,
        open,
        high: Math.max(open, currentPrice),
        low: Math.min(open, currentPrice),
        close: currentPrice,
      }
      series.update(next)
      lastCandleRef.current = next
    } else {
      const next: CandlestickData = {
        time: last.time,
        open: last.open,
        high: Math.max(last.high, currentPrice),
        low: Math.min(last.low, currentPrice),
        close: currentPrice,
      }
      series.update(next)
      lastCandleRef.current = next
    }
  }, [currentPrice, selectedTimeframe])

  // ── Order-block overlays ───────────────────────────────────────────────────
  useEffect(() => {
    const series = seriesRef.current
    if (!series) return
    const liveIds = new Set(activeOrderBlocks.map((o) => o.id))
    for (const [id, line] of priceLinesRef.current) {
      if (!liveIds.has(id)) {
        series.removePriceLine(line)
        priceLinesRef.current.delete(id)
      }
    }
    for (const ob of activeOrderBlocks) {
      if (priceLinesRef.current.has(ob.id)) continue
      const line = series.createPriceLine({
        price: ob.priceLevel,
        color: '#eab308',
        lineStyle: LineStyle.Dotted,
        lineWidth: 1,
        axisLabelVisible: true,
        title: `OB ${ob.direction === 'BULLISH' ? '▲' : '▼'} $${ob.priceLevel.toFixed(0)}`,
      })
      priceLinesRef.current.set(ob.id, line)
    }
  }, [activeOrderBlocks])

  // Format the market label nicely: BTCUSDT → BTC/USDT
  const marketLabel = selectedMarket.includes('USDT')
    ? selectedMarket.replace('USDT', '/USDT')
    : selectedMarket

  return (
    <div className="flex h-full min-h-0 flex-col bg-surface-1">
      {/* ── Chart Header ──────────────────────────────────────────────── */}
      <div className="flex h-10 shrink-0 items-center justify-between border-b border-line px-3 gap-2">
        {/* Left: market selector */}
        <div className="flex items-center gap-2">
          <select
            value={selectedMarket}
            onChange={(e) => setSelectedMarket(e.target.value)}
            className="h-7 rounded border border-line bg-surface-0 px-2 font-mono text-[10px] text-ink outline-none transition focus:border-acid cursor-pointer"
          >
            {['BTCUSDT','ETHUSDT','SOLUSDT','BNBUSDT','XRPUSDT','ADAUSDT','AVAXUSDT','DOGEUSDT','LINKUSDT','DOTUSDT'].map((m) => (
              <option key={m} value={m}>{m.replace('USDT', '/USDT')}</option>
            ))}
          </select>

          {/* Timeframe pills */}
          <div className="flex items-center gap-1">
            {TIMEFRAMES.map((tf) => (
              <button
                key={tf}
                onClick={() => setSelectedTimeframe(tf)}
                className={`h-6 rounded px-1.5 font-mono text-[9px] uppercase tracking-wide transition ${
                  selectedTimeframe === tf
                    ? 'bg-acid text-black font-bold'
                    : 'text-ink-dim hover:text-ink hover:bg-surface-2'
                }`}
              >
                {tf}
              </button>
            ))}
          </div>
        </div>

        {/* Right: live price */}
        <div className="flex items-center gap-2 shrink-0">
          {currentPrice > 0 && (
            <span className="relative flex h-1.5 w-1.5">
              <span className="absolute inset-0 rounded-full bg-profit/60 animate-ping" />
              <span className="relative h-1.5 w-1.5 rounded-full bg-profit" />
            </span>
          )}
          <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-ink-fade">
            {currentPrice > 0
              ? `${marketLabel} · $${currentPrice.toFixed(currentPrice < 1 ? 5 : 2)}`
              : `${marketLabel} · loading…`}
          </span>
        </div>
      </div>

      {/* ── Chart Canvas ──────────────────────────────────────────────── */}
      <div className="relative flex-1 min-h-0">
        <div ref={containerRef} className="absolute inset-0" />
      </div>
    </div>
  )
}
