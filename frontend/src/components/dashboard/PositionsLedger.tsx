'use client'

import { useState } from 'react'
import { useDashboardState } from '@/hooks/dashboard/useDashboardState'

// Spec §6: full-width bottom section. 4 performance summary cards over a
// tabbed trade table. Values are pulled from the global store and update
// in real time.

interface SummaryCardProps {
  title: string
  subtext: string
  value: string
  valueClassName?: string
}

function SummaryCard({ title, subtext, value, valueClassName }: SummaryCardProps) {
  return (
    <div className="flex flex-1 flex-col gap-1 rounded-md border border-line bg-surface-1 px-3 py-2">
      <span className="text-[9.5px] font-semibold uppercase tracking-[0.2em] text-ink-mute">
        {title}
      </span>
      <span className={`font-mono text-[17px] leading-none ${valueClassName ?? 'text-ink-dim'}`}>
        {value}
      </span>
      <span className="text-[9px] uppercase tracking-[0.15em] text-ink-fade">{subtext}</span>
    </div>
  )
}

const fmtUsd = (n: number, signed = false) => {
  const sign = signed && n > 0 ? '+' : n < 0 ? '−' : ''
  return `${sign}$${Math.abs(n).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`
}

const fmtPrice = (n: number) => {
  if (n >= 1_000) return n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  if (n >= 10) return n.toFixed(3)
  if (n >= 1) return n.toFixed(4)
  return n.toFixed(5)
}

const fmtQty = (n: number) => {
  if (n >= 1_000) return n.toFixed(0)
  if (n >= 1) return n.toFixed(3)
  if (n >= 0.001) return n.toFixed(5)
  return n.toFixed(8)
}

const fmtDuration = (ms: number) => {
  const secs = Math.floor(ms / 1000)
  if (secs < 60) return `${secs}s`
  const mins = Math.floor(secs / 60)
  if (mins < 60) return `${mins}m ${secs % 60}s`
  const hrs = Math.floor(mins / 60)
  return `${hrs}h ${mins % 60}m`
}

export default function PositionsLedger() {
  const [activeTab, setActiveTab] = useState<'open' | 'history'>('open')

  const {
    openPositions,
    closedTrades,
    cumulativePnl,
    realizedPnl,
    winRate,
    maxDrawdown,
    closedTradeCount,
    openLongCount,
    openShortCount,
  } = useDashboardState()

  const openColumns = ['Market', 'Side', 'Qty', 'Size', 'Lev', 'Entry', 'SL', 'TP', 'PnL', 'Liq']
  const historyColumns = ['Market', 'Side', 'Entry', 'Exit', 'PnL', 'Size', 'Lev', 'Duration', 'Result']

  const winRateClass =
    closedTradeCount === 0
      ? 'text-ink-dim'
      : winRate > 50
        ? 'text-acid'
        : winRate < 50
          ? 'text-loss'
          : 'text-ink'

  const cumulativeClass =
    cumulativePnl > 0 ? 'text-acid' : cumulativePnl < 0 ? 'text-loss' : 'text-ink-dim'

  return (
    <section className="flex flex-col gap-2 border-t border-line bg-surface-0 px-4 py-2.5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-6">
          <button
            onClick={() => setActiveTab('open')}
            className={`relative pb-1 text-[11px] font-semibold tracking-tight transition ${
              activeTab === 'open' ? 'text-ink' : 'text-ink-mute hover:text-ink-fade'
            }`}
          >
            Open Positions
            {activeTab === 'open' && (
              <div className="absolute -bottom-1 left-0 right-0 h-0.5 bg-acid rounded-t-full" />
            )}
          </button>
          <button
            onClick={() => setActiveTab('history')}
            className={`relative pb-1 text-[11px] font-semibold tracking-tight transition ${
              activeTab === 'history' ? 'text-ink' : 'text-ink-mute hover:text-ink-fade'
            }`}
          >
            Trade History
            {activeTab === 'history' && (
              <div className="absolute -bottom-1 left-0 right-0 h-0.5 bg-acid rounded-t-full" />
            )}
          </button>
        </div>
        <span className="font-mono text-[9.5px] uppercase tracking-[0.2em] text-ink-fade">
          paper · auto-managed · realised {fmtUsd(realizedPnl, true)}
        </span>
      </div>

      {/* 6.1 Performance Summary Metrics */}
      <div className="grid grid-cols-2 gap-2 md:grid-cols-4 mt-2">
        <SummaryCard
          title="Win Rate"
          subtext={closedTradeCount === 0 ? 'Awaiting closed trades' : `${closedTradeCount} closed`}
          value={closedTradeCount === 0 ? '—' : `${winRate.toFixed(1)}%`}
          valueClassName={winRateClass}
        />
        <SummaryCard
          title="Max Drawdown"
          subtext="Closed-trade PNL peak"
          value={maxDrawdown < 0 ? fmtUsd(maxDrawdown, true) : '—'}
          valueClassName={maxDrawdown < 0 ? 'text-loss' : 'text-ink-dim'}
        />
        <SummaryCard
          title="Cumulative PNL"
          subtext="Realized + unrealized"
          value={cumulativePnl === 0 && closedTradeCount === 0 ? '—' : fmtUsd(cumulativePnl, true)}
          valueClassName={cumulativeClass}
        />
        <SummaryCard
          title="Open Positions"
          subtext={`${openLongCount}L · ${openShortCount}S`}
          value={String(openPositions.length)}
          valueClassName="text-ink"
        />
      </div>

      {/* 6.2 Trade Table */}
      <div className="shrink-0 overflow-hidden rounded-md border border-line bg-surface-1">
        <table className="w-full border-collapse">
          <thead>
            <tr className="border-b border-line bg-surface-2/60 text-left">
              {(activeTab === 'open' ? openColumns : historyColumns).map((h, i) => (
                <th
                  key={h}
                  className={`px-2.5 py-1.5 text-[9.5px] font-semibold uppercase tracking-[0.18em] text-ink-mute ${
                    i >= 2 ? 'text-right' : ''
                  }`}
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {activeTab === 'open' && (
              openPositions.length === 0 ? (
                <tr>
                  <td
                    colSpan={openColumns.length}
                    className="px-3 py-7 text-center font-mono text-[9.5px] uppercase tracking-[0.25em] text-ink-fade"
                  >
                    no open positions · awaiting execution feed
                  </td>
                </tr>
              ) : (
                openPositions.map((p) => {
                  const sideClass = p.side === 'LONG' ? 'text-profit' : 'text-loss'
                  const pnlClass = p.pnl >= 0 ? 'text-profit' : 'text-loss'
                  const baseAsset = p.symbol.replace('USDT', '')
                  return (
                    <tr
                      key={p.tradeId}
                      className="border-b border-line/60 transition hover:bg-surface-2/60 last:border-b-0"
                    >
                      <td className="px-2.5 py-1.5 text-[11px] text-ink">
                        <span className="flex items-center gap-1.5">
                          <span>{p.symbol}</span>
                          {p.riskTier === 'AGGRESSIVE' && (
                            <span
                              title="Regression-buffered: extra size, wider SL — built to survive the dip before the pump"
                              className="rounded-sm border border-amber-500/40 bg-amber-500/10 px-1 py-[0.5px] font-mono text-[8.5px] uppercase tracking-[0.2em] text-amber-300"
                            >
                              agg
                            </span>
                          )}
                        </span>
                      </td>
                      <td className={`px-2.5 py-1.5 text-[10.5px] font-semibold ${sideClass}`}>
                        {p.side}
                      </td>
                      <td className="px-2.5 py-1.5 text-right font-mono text-[10.5px] text-ink">
                        {fmtQty(p.qty)} <span className="text-ink-fade">{baseAsset}</span>
                      </td>
                      <td className="px-2.5 py-1.5 text-right font-mono text-[10.5px] text-ink-dim">
                        ${p.sizeUsdt.toFixed(2)}
                      </td>
                      <td className="px-2.5 py-1.5 text-right font-mono text-[10.5px] text-ink-dim">
                        {p.leverage}x
                      </td>
                      <td className="px-2.5 py-1.5 text-right font-mono text-[10.5px] text-ink-dim">
                        {fmtPrice(p.entryPrice)}
                      </td>
                      <td className="px-2.5 py-1.5 text-right font-mono text-[10.5px] text-loss/80">
                        {fmtPrice(p.stopLoss)}
                      </td>
                      <td className="px-2.5 py-1.5 text-right font-mono text-[10.5px] text-profit/80">
                        {fmtPrice(p.takeProfit)}
                      </td>
                      <td className={`px-2.5 py-1.5 text-right font-mono text-[11px] font-semibold ${pnlClass}`}>
                        {fmtUsd(p.pnl, true)}
                      </td>
                      <td className="px-2.5 py-1.5 text-right font-mono text-[10.5px] text-ink-fade">
                        {fmtPrice(p.liqPrice)}
                      </td>
                    </tr>
                  )
                })
              )
            )}

            {activeTab === 'history' && (
              closedTrades.length === 0 ? (
                <tr>
                  <td
                    colSpan={historyColumns.length}
                    className="px-3 py-7 text-center font-mono text-[9.5px] uppercase tracking-[0.25em] text-ink-fade"
                  >
                    No closed trades yet · AI is analyzing the market
                  </td>
                </tr>
              ) : (
                closedTrades.map((p) => {
                  const sideClass = p.side === 'LONG' ? 'text-profit' : 'text-loss'
                  const pnlClass = p.pnl >= 0 ? 'text-profit' : 'text-loss'
                  const duration = Math.max(0, p.closedAt - p.openedAt)
                  const isWin = p.pnl >= 0
                  
                  return (
                    <tr
                      key={p.id}
                      className="border-b border-line/60 transition hover:bg-surface-2/60 last:border-b-0"
                    >
                      <td className="px-2.5 py-1.5 text-[11px] text-ink">
                        {p.symbol}
                      </td>
                      <td className={`px-2.5 py-1.5 text-[10.5px] font-semibold ${sideClass}`}>
                        {p.side}
                      </td>
                      <td className="px-2.5 py-1.5 text-right font-mono text-[10.5px] text-ink-dim">
                        {fmtPrice(p.entryPrice)}
                      </td>
                      <td className="px-2.5 py-1.5 text-right font-mono text-[10.5px] text-ink">
                        {fmtPrice(p.exitPrice)}
                      </td>
                      <td className={`px-2.5 py-1.5 text-right font-mono text-[11px] font-semibold ${pnlClass}`}>
                        {fmtUsd(p.pnl, true)}
                      </td>
                      <td className="px-2.5 py-1.5 text-right font-mono text-[10.5px] text-ink-dim">
                        ${p.sizeUsdt.toFixed(2)}
                      </td>
                      <td className="px-2.5 py-1.5 text-right font-mono text-[10.5px] text-ink-dim">
                        {p.leverage}x
                      </td>
                      <td className="px-2.5 py-1.5 text-right font-mono text-[10.5px] text-ink-dim">
                        {fmtDuration(duration)}
                      </td>
                      <td className="px-2.5 py-1.5 text-right font-mono text-[10.5px]">
                        <span className={`inline-flex items-center px-1.5 py-0.5 rounded-sm border text-[9px] font-semibold uppercase tracking-wider ${
                          isWin 
                            ? 'border-profit/30 bg-profit/10 text-profit' 
                            : 'border-loss/30 bg-loss/10 text-loss'
                        }`}>
                          {isWin ? 'WIN' : 'LOSS'}
                        </span>
                      </td>
                    </tr>
                  )
                })
              )
            )}
          </tbody>
        </table>
      </div>
    </section>
  )
}
