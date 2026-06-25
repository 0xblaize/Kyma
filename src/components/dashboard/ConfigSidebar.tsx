'use client'

import { useId } from 'react'
import { useAccount } from 'wagmi'
import { formatUnits } from 'viem'
import { useDashboardState, type SelectedAsset } from '@/hooks/dashboard/useDashboardState'
import { useWalletAssets } from '@/hooks/dashboard/useWalletAssets'
import { useVaultActions } from '@/hooks/dashboard/useVaultActions'
import { isVaultDeployed } from '@/lib/wagmi'

// Spec §4: vertical right-rail. Now wired to real wallet balances. The user
// picks ETH or USDC; the Allocated Capital input is denominated in that
// asset (no more "Mock USDT"). MAX fills with the actual on-chain balance.
// Deploy is disabled if: wallet not connected, vault not deployed on the
// active chain, asset not supported on the active chain, capital is 0, or
// capital exceeds wallet balance.
export default function ConfigSidebar() {
  const { isConnected, chainId } = useAccount()
  const {
    allocatedCapital,
    riskPerTrade,
    maxDrawdownPct,
    selectedAsset,
    lifecycle,
    txPhase,
    setAllocatedCapital,
    setRiskPerTrade,
    setMaxDrawdownPct,
    setSelectedAsset,
  } = useDashboardState()
  const { byAsset } = useWalletAssets()
  const { deploy } = useVaultActions()

  const capitalId = useId()
  const riskId = useId()
  const ddId = useId()

  const balance = byAsset(selectedAsset)
  const balanceFloat = Number(formatUnits(balance.raw, balance.decimals))
  const vaultLive = isVaultDeployed(chainId)
  const overflow = allocatedCapital > balanceFloat + 1e-9   // float guard

  const isLive = lifecycle === 'active' || lifecycle === 'paused'
  const txBusy = txPhase === 'approving' || txPhase === 'signing' || txPhase === 'pending'
  const canDeploy =
    isConnected &&
    vaultLive &&
    balance.supported &&
    !overflow &&
    allocatedCapital > 0 &&
    lifecycle === 'idle' &&
    !txBusy

  const assetUnitsLabel = selectedAsset

  return (
    <aside className="flex h-full min-h-0 flex-col gap-3 overflow-y-auto border-l border-line bg-surface-1 p-3 [scrollbar-width:thin]">
      {/* Panel header */}
      <div className="flex h-8 items-center justify-between border-b border-line pb-2">
        <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-ink-mute">
          Agent Configuration
        </span>
        <span className="font-mono text-[10px] uppercase tracking-[0.15em] text-ink-fade">
          v1.0 · on-chain
        </span>
      </div>

      {/* Asset toggle — drives MAX, units, and which vault path runs */}
      <div className="flex flex-col gap-2">
        <span className="text-[11px] text-ink-dim">Collateral asset</span>
        <div className="flex h-8 items-center rounded-md border border-line bg-surface-0 p-1 text-[10.5px]">
          <AssetPill
            value="ETH"
            current={selectedAsset}
            disabled={isLive}
            onPick={setSelectedAsset}
          />
          <AssetPill
            value="USDC"
            current={selectedAsset}
            disabled={isLive || !byAsset('USDC').supported}
            onPick={setSelectedAsset}
          />
        </div>
        {!byAsset('USDC').supported && (
          <span className="font-mono text-[9.5px] text-ink-fade">
            USDC not available on this testnet — switch chain or use ETH.
          </span>
        )}
      </div>

      {/* 4.1 Allocated Capital — now real */}
      <div className="flex flex-col gap-2">
        <div className="flex items-baseline justify-between">
          <label htmlFor={capitalId} className="text-[11px] text-ink-dim">
            Allocated Capital
          </label>
          <span className="font-mono text-[10px] text-ink-fade">
            Bal {balance.formatted} {balance.symbol}
          </span>
        </div>
        <div className="relative">
          <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 font-mono text-[11px] uppercase tracking-wider text-ink-mute">
            {assetUnitsLabel}
          </span>
          <input
            id={capitalId}
            type="number"
            min={0}
            step={selectedAsset === 'ETH' ? 0.001 : 1}
            placeholder={selectedAsset === 'ETH' ? '0.0000' : '0.00'}
            disabled={isLive}
            value={allocatedCapital === 0 ? '' : allocatedCapital}
            onChange={(e) => setAllocatedCapital(Number(e.target.value))}
            className={`h-9 w-full rounded-md border bg-surface-0 pl-12 pr-12 font-mono text-[12.5px] text-ink outline-none transition focus:ring-1 disabled:cursor-not-allowed disabled:opacity-60 ${
              overflow
                ? 'border-loss focus:border-loss focus:ring-loss'
                : 'border-line focus:border-acid focus:ring-acid'
            }`}
          />
          <button
            type="button"
            disabled={isLive || balanceFloat === 0}
            onClick={() => setAllocatedCapital(balanceFloat)}
            className="absolute right-2 top-1/2 flex h-6 -translate-y-1/2 items-center rounded bg-acid/15 px-2 text-[10px] font-semibold uppercase tracking-[0.12em] text-acid transition hover:bg-acid/25 disabled:cursor-not-allowed disabled:opacity-60"
          >
            Max
          </button>
        </div>
        {overflow && (
          <span className="font-mono text-[10px] text-loss">
            Exceeds wallet balance ({balance.formatted} {balance.symbol}).
          </span>
        )}
      </div>

      {/* 4.2 Risk Per Trade */}
      <div className="flex flex-col gap-2">
        <div className="flex items-baseline justify-between">
          <label htmlFor={riskId} className="text-[11px] text-ink-dim">
            Risk Per Trade
          </label>
          <span className="font-mono text-[11px] text-acid">
            [ {riskPerTrade.toFixed(1)}% ]
          </span>
        </div>
        <div className="relative flex h-4 items-center">
          <div className="absolute inset-x-0 h-1 rounded-full bg-line" />
          <div
            className="absolute left-0 h-1 rounded-full bg-acid"
            style={{ width: `${((riskPerTrade - 0.1) / (5.0 - 0.1)) * 100}%` }}
          />
          <input
            id={riskId}
            type="range"
            min={0.1}
            max={5.0}
            step={0.1}
            disabled={isLive}
            value={riskPerTrade}
            onChange={(e) => setRiskPerTrade(Number(e.target.value))}
            className="risk-slider relative z-10 h-4 w-full appearance-none bg-transparent disabled:cursor-not-allowed"
          />
        </div>
        <div className="flex justify-between font-mono text-[9px] text-ink-fade">
          <span>0.1%</span>
          <span>5.0%</span>
        </div>
      </div>

      {/* 4.3 Hard Stop-Loss */}
      <div className="flex items-center justify-between gap-3">
        <label htmlFor={ddId} className="text-[11px] text-ink-dim">
          Hard Stop-Loss <span className="text-ink-mute">(Drawdown)</span>
        </label>
        <div className="relative">
          <input
            id={ddId}
            type="number"
            min={1}
            max={100}
            disabled={isLive}
            value={maxDrawdownPct}
            onChange={(e) => setMaxDrawdownPct(Number(e.target.value))}
            className="h-9 w-20 rounded-md border border-line bg-surface-0 pl-2 pr-6 font-mono text-[12px] text-ink outline-none transition focus:border-acid focus:ring-1 focus:ring-acid disabled:cursor-not-allowed disabled:opacity-60"
          />
          <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 font-mono text-[11px] text-ink-mute">
            %
          </span>
        </div>
      </div>

      <div className="flex-1" />

      {/* Pre-flight: now reports wallet + vault + asset + tx phase. */}
      <div className="rounded-md border border-line bg-surface-0/60 p-3">
        <div className="flex items-center justify-between text-[10px] uppercase tracking-[0.15em] text-ink-mute">
          <span>Pre-flight</span>
          <Indicator
            ok={isConnected && vaultLive && balance.supported && !overflow}
            label={
              !isConnected
                ? 'Wallet —'
                : !vaultLive
                  ? 'Vault not deployed'
                  : !balance.supported
                    ? `${balance.symbol} unsupported`
                    : overflow
                      ? 'Over balance'
                      : 'Ready'
            }
          />
        </div>
        <div className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1.5 text-[11px]">
          <span className="text-ink-mute">Position size</span>
          <span className="text-right font-mono text-ink">
            {(allocatedCapital * (riskPerTrade / 100)).toFixed(selectedAsset === 'ETH' ? 4 : 2)} {assetUnitsLabel}
          </span>
          <span className="text-ink-mute">Kill at</span>
          <span className="text-right font-mono text-loss">
            -{(allocatedCapital * (maxDrawdownPct / 100)).toFixed(selectedAsset === 'ETH' ? 4 : 2)} {assetUnitsLabel}
          </span>
        </div>
      </div>

      {/* 4.4 Deploy Agent — now opens a wallet signature prompt. */}
      <button
        type="button"
        disabled={!canDeploy}
        onClick={() => void deploy()}
        className={`group flex h-10 w-full items-center justify-center gap-2 rounded-md text-[13px] font-bold tracking-tight transition ${
          isLive
            ? 'bg-surface-3 text-ink-fade cursor-not-allowed'
            : canDeploy
              ? 'bg-gradient-to-b from-[#84CC16] to-[#65A30D] text-black hover:from-acid hover:to-[#84CC16] hover:shadow-deploy'
              : 'bg-surface-3 text-ink-fade cursor-not-allowed'
        }`}
      >
        {isLive ? (
          <>
            <span className="relative flex h-2 w-2">
              <span className="absolute inset-0 rounded-full bg-acid/60 animate-ping" />
              <span className="relative h-2 w-2 rounded-full bg-acid" />
            </span>
            AGENT LIVE
          </>
        ) : txPhase === 'approving' ? (
          <>APPROVE {selectedAsset}…</>
        ) : txPhase === 'signing' ? (
          <>SIGN IN WALLET…</>
        ) : txPhase === 'pending' ? (
          <>CONFIRMING TX…</>
        ) : (
          <>DEPLOY AGENT</>
        )}
      </button>

      {!isConnected && (
        <p className="-mt-2 text-center text-[10px] text-ink-fade">
          Connect a wallet to enable deploy
        </p>
      )}
      {isConnected && !vaultLive && (
        <p className="-mt-2 text-center text-[10px] text-loss">
          AgentVault not deployed on this chain — see contracts/DEPLOY.md
        </p>
      )}

      <style jsx>{`
        .risk-slider::-webkit-slider-thumb {
          -webkit-appearance: none;
          appearance: none;
          width: 16px;
          height: 16px;
          border-radius: 9999px;
          background: #ffffff;
          box-shadow: 0 2px 6px rgba(0, 0, 0, 0.6);
          cursor: pointer;
          border: 2px solid #a3e635;
        }
        .risk-slider::-moz-range-thumb {
          width: 16px;
          height: 16px;
          border-radius: 9999px;
          background: #ffffff;
          box-shadow: 0 2px 6px rgba(0, 0, 0, 0.6);
          cursor: pointer;
          border: 2px solid #a3e635;
        }
      `}</style>
    </aside>
  )
}

function AssetPill({
  value,
  current,
  disabled,
  onPick,
}: {
  value: SelectedAsset
  current: SelectedAsset
  disabled?: boolean
  onPick: (v: SelectedAsset) => void
}) {
  const active = value === current
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={() => onPick(value)}
      className={`flex h-7 flex-1 items-center justify-center rounded text-[10px] font-semibold uppercase tracking-[0.14em] transition disabled:cursor-not-allowed disabled:opacity-40 ${
        active ? 'bg-acid text-black' : 'text-ink-mute hover:text-ink'
      }`}
    >
      {value}
    </button>
  )
}

function Indicator({ ok, label }: { ok: boolean; label: string }) {
  return <span className={ok ? 'text-profit' : 'text-loss'}>{label}</span>
}
