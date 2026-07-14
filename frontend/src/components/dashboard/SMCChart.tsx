'use client'

import { useEffect, useRef } from 'react'
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

// Spec §5.2: SMC Smart Chart. lightweight-charts, transparent layout so the
// panel background shows through, textColor zinc-500, horizontal gridlines
// zinc-800. Candles emerald-500 / rose-500. Order blocks draw as dotted
// yellow price lines via createPriceLine (Vol.2 §3.2 "crucial UI trick").

const CANDLE_SECONDS = 5    // 5-second candles so live action is visible
const HISTORY_BARS = 80
const START_PRICE = 64_500

function nowBucket(): UTCTimestamp {
  return (Math.floor(Date.now() / 1000 / CANDLE_SECONDS) * CANDLE_SECONDS) as UTCTimestamp
}

// Pure synth — used once on mount to seed a believable history before the
// engine starts emitting live ticks. Random walk + tight body/wick spread.
function seedHistory(now: UTCTimestamp): CandlestickData[] {
  const out: CandlestickData[] = []
  let price = START_PRICE
  for (let i = HISTORY_BARS; i > 0; i--) {
    const t = (now - i * CANDLE_SECONDS) as UTCTimestamp
    const open = price
    const close = price + (Math.random() - 0.5) * 80
    const high = Math.max(open, close) + Math.random() * 30
    const low = Math.min(open, close) - Math.random() * 30
    out.push({ time: t, open, high, low, close })
    price = close
  }
  return out
}

export default function SMCChart() {
  const containerRef = useRef<HTMLDivElement>(null)
  const chartRef = useRef<IChartApi | null>(null)
  const seriesRef = useRef<ISeriesApi<'Candlestick'> | null>(null)
  const lastCandleRef = useRef<CandlestickData | null>(null)
  const priceLinesRef = useRef<Map<number, IPriceLine>>(new Map())

  const { currentPrice, activeOrderBlocks, resetNonce, active, selectedMarket } = useDashboardState()

  // One-time chart construction.
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
      timeScale: { borderColor: '#27272a', timeVisible: true, secondsVisible: true },
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
      if (!el) return
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

  // Seed / re-seed history. Runs on mount and on every reset so the chart
  // starts clean after a "Reset Simulation" press.
  useEffect(() => {
    const series = seriesRef.current
    const chart = chartRef.current
    if (!series || !chart) return
    // Clear any existing order-block lines first — they belong to the prior
    // session and would point at stale prices.
    for (const line of priceLinesRef.current.values()) series.removePriceLine(line)
    priceLinesRef.current.clear()

    const data = seedHistory(nowBucket())
    series.setData(data)
    lastCandleRef.current = data[data.length - 1] ?? null
    chart.timeScale().fitContent()
  }, [resetNonce])

  // Live tick handling. Each market_tick from the store either extends the
  // current candle (update high/low/close) or rolls over into a new one.
  useEffect(() => {
    const series = seriesRef.current
    if (!series || currentPrice <= 0) return
    const bucket = nowBucket()
    const last = lastCandleRef.current
    if (!last || last.time !== bucket) {
      // New candle — open at the prior close (or current price on first tick).
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
  }, [currentPrice])

  // Order-block overlays — one yellow dotted price line per OB. We diff
  // against the ref-held Map to add new ones and drop any that the store
  // dropped (the store caps OB count to keep the chart legible).
  useEffect(() => {
    const series = seriesRef.current
    if (!series) return
    const liveIds = new Set(activeOrderBlocks.map((o) => o.id))
    // Remove lines that no longer have a backing OB.
    for (const [id, line] of priceLinesRef.current) {
      if (!liveIds.has(id)) {
        series.removePriceLine(line)
        priceLinesRef.current.delete(id)
      }
    }
    // Add lines for new OBs.
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

  const showOverlay = !active && currentPrice === 0

  return (
    <div className="flex h-full min-h-0 flex-col bg-surface-1">
      <div className="flex h-8 items-center justify-between border-b border-line px-4">
        <div className="flex items-center gap-2.5">
          <span className="text-[11px] font-semibold tracking-tight text-ink">SMC Chart</span>
          <span className="rounded-sm border border-line bg-surface-2 px-1.5 py-[1px] font-mono text-[9px] tracking-[0.18em] text-ink-dim">
            1m
          </span>
        </div>
        <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-ink-fade">
          {currentPrice > 0
            ? `${selectedMarket} · $${currentPrice.toFixed(2)}`
            : 'awaiting candle feed'}
        </span>
      </div>
      <div className="relative flex-1 min-h-0">
        <div ref={containerRef} className="absolute inset-0" />
        {showOverlay && (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
            <span className="rounded-md border border-line bg-surface-1/80 px-3 py-1 font-mono text-[10px] uppercase tracking-[0.28em] text-ink-fade backdrop-blur">
              deploy agent to begin streaming
            </span>
          </div>
        )}
      </div>
    </div>
  )
}
