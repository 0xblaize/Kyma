'use client'

import { useState } from 'react'
import { useAccount, useSwitchChain } from 'wagmi'
import { baseSepolia } from 'wagmi/chains'
import { chainAssets } from '@/lib/wagmi'

// Floating soft-suggestion banner: appears when the wallet is connected but
// not on Base Sepolia (the recommended chain — USDC support + fast/cheap txs).
// Dismissible per session; doesn't block anything.
export default function ChainBanner() {
  const { isConnected, chainId } = useAccount()
  const { switchChain, isPending } = useSwitchChain()
  const [dismissed, setDismissed] = useState(false)

  if (!isConnected || dismissed) return null
  if (chainId === baseSepolia.id) return null

  const currentLabel = chainAssets(chainId)?.shortLabel ?? 'this chain'

  return (
    <div className="pointer-events-none absolute left-1/2 top-[60px] z-40 -translate-x-1/2">
      <div className="pointer-events-auto flex items-center gap-3 rounded-full border border-warn/40 bg-surface-1/90 px-3 py-1.5 shadow-[0_8px_24px_-12px_rgba(0,0,0,0.6)] backdrop-blur">
        <span className="h-1.5 w-1.5 rounded-full bg-warn shadow-[0_0_8px_rgba(234,179,8,0.7)]" />
        <span className="font-mono text-[10.5px] tracking-wide text-ink-dim">
          You&rsquo;re on <span className="text-ink">{currentLabel}</span>. Base Sepolia is the recommended testnet for Agent.OS.
        </span>
        <button
          type="button"
          disabled={isPending}
          onClick={() => switchChain({ chainId: baseSepolia.id })}
          className="rounded-full bg-acid px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-black transition hover:bg-[#bef264] disabled:opacity-60"
        >
          {isPending ? 'Switching…' : 'Switch to Base Sepolia'}
        </button>
        <button
          type="button"
          onClick={() => setDismissed(true)}
          aria-label="Dismiss"
          className="flex h-5 w-5 items-center justify-center rounded-full text-ink-mute transition hover:bg-surface-2 hover:text-ink"
        >
          <svg width="9" height="9" viewBox="0 0 9 9" fill="none">
            <path d="M2 2l5 5M7 2l-5 5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
          </svg>
        </button>
      </div>
    </div>
  )
}
