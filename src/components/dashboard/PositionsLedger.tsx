'use client'

import { useDashboardState } from '@/hooks/dashboard/useDashboardState'

// Spec §6: full-width bottom section. 4 performance summary cards over a
// 9-column trade table. Values are pulled from the global store and update
// in real time as the mock engine emits portfolio_update events.

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

const fmtPrice = (n: number) =>
  n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })

export default function PositionsLedger() {
  const {
    openPositions,
    cumulativePnl,
    realizedPnl,
    winRate,
    maxDrawdown,
    closedTradeCount,
    openLongCount,
    openShortCount,
  } = useDashboardState()

  const columns = ['Asset', 'Side', 'Size', 'Lev', 'Entry', 'SL', 'TP', 'PnL', 'Liq']

  // Spec §6.1 color rules:
  //   Win rate  · acid if > 50, rose if < 50, dim until any trades close
  //   Max DD    · always rose unless still 0
  //   Cum PNL   · acid if positive, rose if negative, dim if flat
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
        <span className="text-[11px] font-semibold tracking-tight text-ink">
          Positions &amp; Performance
        </span>
        <span className="font-mono text-[9.5px] uppercase tracking-[0.2em] text-ink-fade">
          paper · auto-managed · realised {fmtUsd(realizedPnl, true)}
        </span>
      </div>

      {/* 6.1 Performance Summary Metrics */}
      <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
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
      <div className="overflow-hidden rounded-md border border-line bg-surface-1">
        <table className="w-full border-collapse">
          <thead>
            <tr className="border-b border-line bg-surface-2/60 text-left">
              {columns.map((h, i) => (
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
            {openPositions.length === 0 ? (
              <tr>
                <td
                  colSpan={columns.length}
                  className="px-3 py-7 text-center font-mono text-[9.5px] uppercase tracking-[0.25em] text-ink-fade"
                >
                  no open positions · awaiting execution feed
                </td>
              </tr>
            ) : (
              openPositions.map((p) => {
                const sideClass = p.side === 'LONG' ? 'text-profit' : 'text-loss'
                const pnlClass = p.pnl >= 0 ? 'text-profit' : 'text-loss'
                return (
                  <tr
                    key={p.tradeId}
                    className="border-b border-line/60 transition hover:bg-surface-2/60 last:border-b-0"
                  >
                    <td className="px-2.5 py-1.5 text-[11px] text-ink">{p.symbol}</td>
                    <td className={`px-2.5 py-1.5 text-[10.5px] font-semibold ${sideClass}`}>
                      {p.side}
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
            )}
          </tbody>
        </table>
      </div>
    </section>
  )
}
