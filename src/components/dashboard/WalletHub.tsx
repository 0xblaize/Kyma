'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import {
  useAccount,
  useBalance,
  useChainId,
  useConnect,
  useDisconnect,
  useSwitchChain,
} from 'wagmi'
import { supportedChain } from '@/lib/wagmi'

// Header wallet widget. Three visual states:
//   1. Disconnected — solid acid CTA that opens a connector-picker modal.
//   2. Wrong network — amber chip nudging user to switch to Sepolia.
//   3. Connected — gradient address chip + live Sepolia balance, with a
//      dropdown for Copy address / Disconnect / View on Etherscan.
// The component leans into the Dribbble trading-dashboard aesthetic:
// rounded-xl pills, soft 1px borders that brighten on hover, a faint
// gradient stripe on the address chip, and a glassmorphic modal/dropdown.

function shortenAddress(addr: string) {
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`
}

function formatBalance(value: bigint, decimals: number) {
  // 4-dp precision is enough for an ETH balance in the header. We use
  // string slicing instead of toFixed to avoid IEEE drift on small amounts.
  const whole = value / 10n ** BigInt(decimals)
  const frac = value % 10n ** BigInt(decimals)
  const fracStr = frac.toString().padStart(decimals, '0').slice(0, 4)
  return `${whole.toString()}.${fracStr}`
}

export default function WalletHub() {
  const { address, isConnected, connector: activeConnector } = useAccount()
  const chainId = useChainId()
  const { connectors, connect, isPending: isConnecting, error: connectError } = useConnect()
  const { disconnect } = useDisconnect()
  const { switchChain, isPending: isSwitching } = useSwitchChain()
  const { data: balance } = useBalance({
    address,
    chainId: supportedChain.id,
    query: { enabled: Boolean(address), refetchInterval: 12_000 },
  })

  const onCorrectChain = chainId === supportedChain.id

  const [pickerOpen, setPickerOpen] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const [copied, setCopied] = useState(false)
  const menuRef = useRef<HTMLDivElement | null>(null)

  // Close dropdown when clicking outside. The picker modal handles its
  // own dismiss via the backdrop.
  useEffect(() => {
    if (!menuOpen) return
    const onDown = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false)
      }
    }
    window.addEventListener('mousedown', onDown)
    return () => window.removeEventListener('mousedown', onDown)
  }, [menuOpen])

  // Dismiss the picker the moment a connection lands.
  useEffect(() => {
    if (isConnected) setPickerOpen(false)
  }, [isConnected])

  const copyAddress = async () => {
    if (!address) return
    try {
      await navigator.clipboard.writeText(address)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {
      // clipboard can fail in dev (HTTP), no recovery needed
    }
  }

  // ─── Disconnected ────────────────────────────────────────────────────────
  if (!isConnected || !address) {
    return (
      <>
        <button
          type="button"
          onClick={() => setPickerOpen(true)}
          className="group flex h-9 items-center gap-2.5 rounded-xl bg-acid px-4 text-[12px] font-semibold tracking-tight text-black shadow-[0_8px_24px_-12px_rgba(163,230,53,0.6)] transition hover:bg-[#bef264] active:bg-[#84cc16]"
        >
          <span className="relative flex h-2 w-2">
            <span className="absolute inset-0 rounded-full bg-black/40 animate-ping" />
            <span className="relative h-2 w-2 rounded-full bg-black/70" />
          </span>
          Connect wallet
        </button>
        {pickerOpen && (
          <ConnectorPicker
            connectors={connectors}
            isPending={isConnecting}
            error={connectError?.message}
            onPick={(c) => connect({ connector: c })}
            onClose={() => setPickerOpen(false)}
          />
        )}
      </>
    )
  }

  // ─── Wrong network ───────────────────────────────────────────────────────
  if (!onCorrectChain) {
    return (
      <div className="flex items-center gap-2">
        <button
          type="button"
          disabled={isSwitching}
          onClick={() => switchChain({ chainId: supportedChain.id })}
          className="flex h-9 items-center gap-2 rounded-xl border border-warn/40 bg-warn/10 px-3.5 text-[11px] font-semibold tracking-tight text-warn transition hover:bg-warn/15 disabled:opacity-60"
        >
          <span className="h-1.5 w-1.5 rounded-full bg-warn" />
          {isSwitching ? 'Switching…' : 'Switch to Sepolia'}
        </button>
        <button
          type="button"
          onClick={() => disconnect()}
          className="flex h-9 items-center rounded-xl border border-line bg-surface-1 px-3 text-[11px] font-medium text-ink-dim transition hover:border-white/15 hover:text-ink"
        >
          Disconnect
        </button>
      </div>
    )
  }

  // ─── Connected ───────────────────────────────────────────────────────────
  return (
    <div ref={menuRef} className="relative">
      <button
        type="button"
        onClick={() => setMenuOpen((v) => !v)}
        className="group flex h-9 items-center gap-3 rounded-xl border border-line bg-gradient-to-r from-surface-1 via-surface-1 to-surface-2 px-1 pr-3 transition hover:border-acid/30"
      >
        <span className="flex h-7 items-center gap-2 rounded-lg bg-gradient-to-br from-acid/20 via-acid/5 to-transparent px-2.5">
          <span className="h-1.5 w-1.5 rounded-full bg-profit shadow-[0_0_8px_rgba(52,211,153,0.6)]" />
          <span className="font-mono text-[11px] font-medium tracking-tight text-ink">
            {shortenAddress(address)}
          </span>
        </span>
        <span className="flex flex-col items-end leading-none">
          <span className="text-[8.5px] font-medium uppercase tracking-[0.18em] text-ink-mute">
            Sepolia
          </span>
          <span className="mt-0.5 font-mono text-[11px] text-ink">
            {balance ? `${formatBalance(balance.value, balance.decimals)} ${balance.symbol}` : '—'}
          </span>
        </span>
        <svg
          width="10"
          height="10"
          viewBox="0 0 10 10"
          className={`text-ink-mute transition group-hover:text-ink ${menuOpen ? 'rotate-180' : ''}`}
        >
          <path d="M2 4l3 3 3-3" stroke="currentColor" strokeWidth="1.4" fill="none" strokeLinecap="round" />
        </svg>
      </button>

      {menuOpen && (
        <div className="absolute right-0 top-12 z-40 w-64 overflow-hidden rounded-xl border border-line bg-surface-1/95 shadow-[0_20px_60px_-20px_rgba(0,0,0,0.7)] backdrop-blur-xl">
          <div className="border-b border-line/60 px-3.5 py-3">
            <div className="flex items-center justify-between">
              <span className="text-[9px] font-medium uppercase tracking-[0.2em] text-ink-mute">
                Account
              </span>
              {activeConnector?.name && (
                <span className="text-[9px] uppercase tracking-[0.18em] text-ink-mute">
                  {activeConnector.name}
                </span>
              )}
            </div>
            <div className="mt-1.5 font-mono text-[12px] text-ink">{shortenAddress(address)}</div>
            <div className="mt-3 flex items-end justify-between">
              <div className="flex flex-col leading-tight">
                <span className="text-[9px] font-medium uppercase tracking-[0.18em] text-ink-mute">
                  Balance
                </span>
                <span className="font-mono text-[14px] text-ink">
                  {balance
                    ? `${formatBalance(balance.value, balance.decimals)} ${balance.symbol}`
                    : '—'}
                </span>
              </div>
              <span className="rounded-md bg-acid/10 px-2 py-0.5 text-[9px] font-semibold uppercase tracking-[0.18em] text-acid">
                Sepolia
              </span>
            </div>
          </div>
          <div className="flex flex-col py-1.5">
            <MenuItem
              label={copied ? 'Copied' : 'Copy address'}
              icon={
                <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
                  <rect x="2.5" y="2.5" width="6" height="6" rx="1" stroke="currentColor" strokeWidth="1.2" />
                  <rect x="4.5" y="4.5" width="6" height="6" rx="1" stroke="currentColor" strokeWidth="1.2" />
                </svg>
              }
              onClick={copyAddress}
            />
            <a
              href={`https://sepolia.etherscan.io/address/${address}`}
              target="_blank"
              rel="noreferrer"
              className="flex h-9 items-center gap-2.5 px-3.5 text-[11px] font-medium text-ink-dim transition hover:bg-surface-2 hover:text-ink"
            >
              <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
                <path
                  d="M5 3H3v7h7V8M7.5 2.5H10v2.5M10 2.5L6 6.5"
                  stroke="currentColor"
                  strokeWidth="1.2"
                  strokeLinecap="round"
                />
              </svg>
              View on Etherscan
            </a>
            <div className="my-1.5 h-px bg-line/60" />
            <MenuItem
              label="Disconnect"
              danger
              icon={
                <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
                  <path
                    d="M5 3.5H3.5v6H5M7 2.5l3 4-3 4M10 6.5H5.5"
                    stroke="currentColor"
                    strokeWidth="1.2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              }
              onClick={() => {
                disconnect()
                setMenuOpen(false)
              }}
            />
          </div>
        </div>
      )}
    </div>
  )
}

interface MenuItemProps {
  label: string
  icon: React.ReactNode
  onClick: () => void
  danger?: boolean
}

function MenuItem({ label, icon, onClick, danger }: MenuItemProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex h-9 items-center gap-2.5 px-3.5 text-left text-[11px] font-medium transition ${
        danger
          ? 'text-loss/90 hover:bg-loss/10 hover:text-loss'
          : 'text-ink-dim hover:bg-surface-2 hover:text-ink'
      }`}
    >
      {icon}
      <span>{label}</span>
    </button>
  )
}

// ─── Connector picker modal ────────────────────────────────────────────────

// Use wagmi's own connector type so `onPick` hands back something `connect()`
// will accept. The previous narrowed shape (uid/id/name/icon) was missing the
// runtime methods wagmi's `Connector` carries, which broke the build.
type WagmiConnector = ReturnType<typeof useConnect>['connectors'][number]

interface PickerProps {
  connectors: readonly WagmiConnector[]
  isPending: boolean
  error?: string
  onPick: (c: WagmiConnector) => void
  onClose: () => void
}

function ConnectorPicker({ connectors, isPending, error, onPick, onClose }: PickerProps) {
  // De-dupe by id — wagmi can register the same wallet under multiple uids
  // (e.g. multiple injected providers from different extensions). We surface
  // each unique provider once, preferring the first occurrence.
  const unique = useMemo(() => {
    const seen = new Set<string>()
    return connectors.filter((c) => {
      if (seen.has(c.id)) return false
      seen.add(c.id)
      return true
    })
  }, [connectors])

  // Escape closes the modal.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div
        className="absolute inset-0 bg-black/70 backdrop-blur-md"
        onClick={onClose}
      />
      <div className="relative z-10 w-[400px] overflow-hidden rounded-2xl border border-line bg-gradient-to-b from-surface-1 to-surface-0 shadow-[0_30px_80px_-20px_rgba(0,0,0,0.8)]">
        <div className="relative flex items-start justify-between px-5 pt-5 pb-4">
          <div>
            <h3 className="text-[15px] font-semibold tracking-tight text-ink">Connect a wallet</h3>
            <p className="mt-1 text-[11px] text-ink-mute">
              Choose how you&rsquo;d like to connect. Sepolia testnet only.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-7 w-7 items-center justify-center rounded-lg text-ink-mute transition hover:bg-surface-2 hover:text-ink"
          >
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
              <path d="M3 3l6 6M9 3l-6 6" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
            </svg>
          </button>
        </div>
        <div className="flex flex-col gap-1.5 px-3 pb-3">
          {unique.length === 0 && (
            <div className="rounded-xl border border-line bg-surface-2/40 px-4 py-6 text-center text-[11px] text-ink-mute">
              No wallet detected. Install a browser wallet such as MetaMask.
            </div>
          )}
          {unique.map((c) => (
            <button
              key={c.uid}
              type="button"
              disabled={isPending}
              onClick={() => onPick(c)}
              className="group flex items-center gap-3 rounded-xl border border-line/60 bg-surface-1 px-3.5 py-3 text-left transition hover:border-acid/40 hover:bg-surface-2 disabled:opacity-60"
            >
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br from-acid/20 to-acid/5 ring-1 ring-acid/20">
                {c.icon ? (
                  // wagmi connectors may expose an SVG/data URI icon
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={c.icon} alt="" className="h-5 w-5" />
                ) : (
                  <ConnectorGlyph id={c.id} />
                )}
              </div>
              <div className="flex flex-1 flex-col leading-tight">
                <span className="text-[12.5px] font-semibold text-ink">{prettyName(c)}</span>
                <span className="text-[10px] tracking-wide text-ink-mute">
                  {connectorTagline(c.id)}
                </span>
              </div>
              <svg
                width="12"
                height="12"
                viewBox="0 0 12 12"
                className="text-ink-mute transition group-hover:translate-x-0.5 group-hover:text-acid"
              >
                <path d="M3 6h6M7 3l3 3-3 3" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" fill="none" />
              </svg>
            </button>
          ))}
        </div>
        {error && (
          <div className="border-t border-line/60 bg-loss/5 px-5 py-3 text-[11px] text-loss">
            {error}
          </div>
        )}
        <div className="border-t border-line/60 bg-surface-0/60 px-5 py-3">
          <p className="text-[10px] tracking-wide text-ink-mute">
            By connecting, you agree to Agent.OS&rsquo;s simulated paper-trading terms. No real
            funds are moved on Sepolia.
          </p>
        </div>
      </div>
    </div>
  )
}

function prettyName(c: { id: string; name: string }) {
  if (c.id === 'injected') return c.name === 'Injected' ? 'Browser wallet' : c.name
  if (c.id === 'walletConnect') return 'WalletConnect'
  return c.name
}

function connectorTagline(id: string) {
  if (id === 'injected') return 'MetaMask, Rabby, Brave & other extensions'
  if (id === 'walletConnect') return 'Scan a QR with a mobile wallet'
  return 'Connect via this provider'
}

function ConnectorGlyph({ id }: { id: string }) {
  if (id === 'walletConnect') {
    return (
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
        <path
          d="M3.5 6.5c2.5-2.5 6.5-2.5 9 0M5.2 8.2c1.55-1.55 4.05-1.55 5.6 0"
          stroke="#a3e635"
          strokeWidth="1.4"
          strokeLinecap="round"
        />
      </svg>
    )
  }
  // Injected / generic
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
      <rect x="2.5" y="4" width="11" height="8" rx="1.5" stroke="#a3e635" strokeWidth="1.4" />
      <circle cx="11" cy="8" r="1" fill="#a3e635" />
    </svg>
  )
}
