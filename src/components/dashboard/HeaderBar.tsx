'use client'

import { useDashboardState } from '@/hooks/dashboard/useDashboardState'
import { useWalletAssets } from '@/hooks/dashboard/useWalletAssets'
import TickerStream from './TickerStream'
import WalletHub from './WalletHub'

// Spec §2: top header h-16. Left = brand, center = system-status text,
// right = wallet + equity. Equity is now the REAL on-chain balance of the
// user's selected asset (ETH or USDC) on the connected testnet, not a mock.
export default function HeaderBar() {
  const { active, paused, terminated, selectedAsset } = useDashboardState()
  const { eth, usdc, chainLabel, isConnected, byAsset } = useWalletAssets()

  const statusText = terminated
    ? 'Agent terminated'
    : paused
      ? 'Perception paused'
      : active
        ? 'Processing live data'
        : 'Awaiting market feed'

  const ellipsisOn = active
  const balance = byAsset(selectedAsset)

  return (
    <header className="grid h-[52px] grid-cols-[auto_1fr_auto] items-center gap-4 border-b border-line bg-surface-1 px-4">
      {/* 2.1 Brand */}
      <a
        href="/dashboard"
        className="flex items-center gap-2.5"
        onClick={(e) => {
          e.preventDefault()
          window.location.reload()
        }}
      >
        <div className="flex h-7 w-7 items-center justify-center rounded-md bg-[#1e293b] ring-1 ring-[#475569]/40">
          <span className="text-[12px] font-extrabold leading-none text-acid">A</span>
        </div>
        <div className="flex flex-col leading-none">
<<<<<<< HEAD
          <span className="text-[15px] font-bold tracking-tight text-ink">Kyma</span>
=======
          <span className="text-[15px] font-bold tracking-tight text-ink">Agent.OS</span>
>>>>>>> 329e9be2135d833cd4216995a8008f2985cca82d
          <span className="mt-0.5 font-mono text-[9px] uppercase tracking-[0.22em] text-ink-fade">
            v1.0.0 · paper
          </span>
        </div>
      </a>

      {/* 2.2 System Status — center */}
      <div className="flex items-center justify-center">
        <span
          className={`font-mono text-[11px] tracking-wide ${
            ellipsisOn ? 'ellipsis-anim text-ink-mute' : 'text-ink-fade'
          }`}
        >
          {statusText}
        </span>
      </div>

      {/* 2.3 Wallet + Equity */}
      <div className="flex items-center gap-2.5">
        <div className="hidden xl:block">
          <TickerStream />
        </div>
        <BalanceTile
          balance={balance}
          alternate={selectedAsset === 'ETH' ? usdc : eth}
          chainLabel={chainLabel}
          connected={isConnected}
        />
        <WalletHub />
      </div>
    </header>
  )
}

// Real-balance tile. Top line = chain badge + primary asset; bottom line =
// secondary asset for at-a-glance "do I have the other token too?". When the
// wallet isn't connected we render the same shell with em-dashes so the
// header doesn't shift layout on connect.
interface BalanceTileProps {
  balance: { symbol: string; formatted: string; supported: boolean }
  alternate: { symbol: string; formatted: string; supported: boolean }
  chainLabel: string
  connected: boolean
}

function BalanceTile({ balance, alternate, chainLabel, connected }: BalanceTileProps) {
  const primary = connected
    ? balance.supported
      ? `${balance.formatted} ${balance.symbol}`
      : `— ${balance.symbol}`
    : '—'
  const secondary = connected
    ? alternate.supported
      ? `${alternate.formatted} ${alternate.symbol}`
      : `${alternate.symbol} n/a`
    : '—'

  return (
    <div className="flex h-9 flex-col items-end justify-center rounded-lg border border-line bg-surface-1 px-3 leading-none">
      <div className="flex items-center gap-1.5">
        <span className="rounded-sm bg-acid/10 px-1.5 py-[1px] font-mono text-[8px] uppercase tracking-[0.18em] text-acid">
          {connected ? chainLabel : 'No chain'}
        </span>
        <span className="font-mono text-[11px] font-semibold text-ink">{primary}</span>
      </div>
      <span className="mt-0.5 font-mono text-[9px] text-ink-fade">{secondary}</span>
    </div>
  )
}
