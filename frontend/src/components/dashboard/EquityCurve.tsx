'use client'

import { useDashboardState } from '@/hooks/dashboard/useDashboardState'

interface EquityCurveProps {
  width?: number
  height?: number
}

export default function EquityCurve({ width = 120, height = 32 }: EquityCurveProps) {
  const { equityHistory, allocatedCapital } = useDashboardState()

  // If we don't have enough data, just show a flat dotted line
  if (equityHistory.length < 2) {
    const y = height / 2
    return (
      <div className="flex items-center gap-3">
        <svg width={width} height={height} className="overflow-visible">
          <line
            x1={0}
            y1={y}
            x2={width}
            y2={y}
            stroke="#52525b"
            strokeWidth={1.5}
            strokeDasharray="2 4"
          />
        </svg>
        <div className="flex flex-col justify-center">
          <span className="font-mono text-[9px] uppercase tracking-wider text-ink-mute">Running Equity</span>
          <span className="font-mono text-[11px] font-semibold text-ink-dim">—</span>
        </div>
      </div>
    )
  }

  const first = equityHistory[0]
  const last = equityHistory[equityHistory.length - 1]
  const isProfit = last >= first

  const strokeColor = isProfit ? '#a3e635' : '#f43f5e'
  const pnl = last - first

  // Scaling
  const minVal = Math.min(...equityHistory)
  const maxVal = Math.max(...equityHistory)
  const range = maxVal - minVal || 1 // Avoid div by 0

  const dx = width / (equityHistory.length - 1)

  // Map data to SVG points
  const points = equityHistory.map((val, i) => {
    const x = i * dx
    const normalized = (val - minVal) / range
    // SVG y=0 is top, so we invert
    const y = height - normalized * (height - 4) - 2
    return `${x},${y}`
  })

  const pathStr = points.join(' ')
  
  // For the gradient fill
  const fillPathStr = `${pathStr} ${width},${height} 0,${height}`

  const fmtUsd = (n: number) => {
    const sign = n > 0 ? '+' : n < 0 ? '−' : ''
    return `${sign}$${Math.abs(n).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
  }

  return (
    <div className="flex items-center gap-3">
      <svg width={width} height={height} className="overflow-visible">
        <defs>
          <linearGradient id="equityGradProfit" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#a3e635" stopOpacity="0.2" />
            <stop offset="100%" stopColor="#a3e635" stopOpacity="0" />
          </linearGradient>
          <linearGradient id="equityGradLoss" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#f43f5e" stopOpacity="0.2" />
            <stop offset="100%" stopColor="#f43f5e" stopOpacity="0" />
          </linearGradient>
        </defs>
        
        {/* Fill */}
        <polygon
          points={fillPathStr}
          fill={isProfit ? 'url(#equityGradProfit)' : 'url(#equityGradLoss)'}
        />
        
        {/* Stroke */}
        <polyline
          points={pathStr}
          fill="none"
          stroke={strokeColor}
          strokeWidth={1.5}
          strokeLinejoin="round"
          strokeLinecap="round"
        />
      </svg>
      <div className="flex flex-col justify-center">
        <span className="font-mono text-[9px] uppercase tracking-wider text-ink-mute">Running Equity</span>
        <span className={`font-mono text-[11px] font-semibold ${isProfit ? 'text-profit' : 'text-loss'}`}>
          {fmtUsd(pnl)}
        </span>
      </div>
    </div>
  )
}
