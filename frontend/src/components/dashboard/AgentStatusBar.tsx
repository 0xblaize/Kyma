'use client'

import { useEffect, useState } from 'react'
import { useDashboardState } from '@/hooks/dashboard/useDashboardState'

// Formats seconds into HH:MM:SS runtime display
function formatRuntime(seconds: number): string {
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = seconds % 60
  if (h > 0) return `${h}h ${m.toString().padStart(2, '0')}m ${s.toString().padStart(2, '0')}s`
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`
}

export default function AgentStatusBar() {
  const {
    lifecycle,
    openPositions,
    closedTradeCount,
    realizedPnl,
    unrealizedPnl,
    winRate,
    selectedMarket,
    selectedTimeframe,
    currentPrice,
  } = useDashboardState()

  const [runtime, setRuntime] = useState(0)
  const [startTime] = useState(Date.now())

  const isLive = lifecycle === 'active'
  const isPaused = lifecycle === 'paused'
  const isVisible = isLive || isPaused

  // Runtime counter
  useEffect(() => {
    if (!isLive) return
    const interval = setInterval(() => {
      setRuntime(Math.floor((Date.now() - startTime) / 1000))
    }, 1000)
    return () => clearInterval(interval)
  }, [isLive, startTime])

  if (!isVisible) return null

  const totalPnl = realizedPnl + unrealizedPnl
  const pnlPositive = totalPnl >= 0
  const marketLabel = selectedMarket.replace('USDT', '/USDT')

  return (
    <div className="flex h-8 shrink-0 items-center gap-4 border-b border-line bg-surface-1/80 px-4 backdrop-blur">
      {/* Status dot + label */}
      <div className="flex items-center gap-1.5">
        <span className="relative flex h-1.5 w-1.5">
          <span className={`absolute inset-0 rounded-full ${isLive ? 'bg-profit/60 animate-ping' : 'bg-warn/60'}`} />
          <span className={`relative h-1.5 w-1.5 rounded-full ${isLive ? 'bg-profit' : 'bg-warn'}`} />
        </span>
        <span className={`font-mono text-[9px] uppercase tracking-[0.22em] ${isLive ? 'text-profit' : 'text-warn'}`}>
          {isLive ? 'Agent Live' : 'Paused'}
        </span>
      </div>

      <div className="h-3 w-px bg-line" />

      {/* Market */}
      <span className="font-mono text-[10px] text-ink-dim">
        {marketLabel}
        <span className="ml-1.5 text-ink-fade">{selectedTimeframe}</span>
      </span>

      {/* Live price */}
      {currentPrice > 0 && (
        <span className="font-mono text-[10px] font-semibold text-ink">
          ${currentPrice.toFixed(currentPrice < 1 ? 5 : 2)}
        </span>
      )}

      <div className="h-3 w-px bg-line" />

      {/* Trade count */}
      <span className="font-mono text-[10px] text-ink-dim">
        <span className="text-ink">{closedTradeCount}</span> trades closed
        {openPositions.length > 0 && (
          <span className="ml-2 text-acid">{openPositions.length} open</span>
        )}
      </span>

      {/* Win rate */}
      {closedTradeCount > 0 && (
        <>
          <div className="h-3 w-px bg-line" />
          <span className="font-mono text-[10px] text-ink-dim">
            Win rate <span className={winRate >= 50 ? 'text-profit' : 'text-loss'}>{winRate.toFixed(0)}%</span>
          </span>
        </>
      )}

      {/* PnL */}
      <div className="h-3 w-px bg-line" />
      <span className={`font-mono text-[10px] font-semibold ${pnlPositive ? 'text-profit' : 'text-loss'}`}>
        {pnlPositive ? '+' : ''}{totalPnl.toFixed(2)} USDT
      </span>

      {/* Runtime — pushed to the right */}
      <div className="ml-auto font-mono text-[9px] text-ink-fade">
        {formatRuntime(runtime)}
      </div>
    </div>
  )
}
