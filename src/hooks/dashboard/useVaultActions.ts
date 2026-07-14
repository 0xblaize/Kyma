'use client'

import { useCallback } from 'react'
import { useAccount, useChainId, useConfig, useWriteContract } from 'wagmi'
import { readContract, waitForTransactionReceipt } from 'wagmi/actions'
import { parseUnits, type Address } from 'viem'
import { chainAssets } from '@/lib/wagmi'
import { agentVaultAbi, erc20Abi } from '@/lib/vaultAbi'
import { useDashboardState } from './useDashboardState'

const ZERO: Address = '0x0000000000000000000000000000000000000000'

// ─────────────────────────────────────────────────────────────────────────
// useVaultActions — every dashboard action that "does something" now flows
// through here so the wallet pops a signature prompt and the lifecycle only
// advances on a confirmed receipt. Replaces the in-memory deploy/terminate/
// pause that the reducer used to drive directly.
// ─────────────────────────────────────────────────────────────────────────

export function useVaultActions() {
  const { address } = useAccount()
  const chainId = useChainId()
  const config = useConfig()
  const assets = chainAssets(chainId)
  const { writeContractAsync } = useWriteContract()

  const {
    selectedAsset,
    allocatedCapital,
    riskPerTrade,
    maxDrawdownPct,
    paused,
    setTxPhase,
    deployAgent: dispatchDeploy,
    terminate: dispatchTerminate,
    togglePaused: dispatchTogglePaused,
    resetSimulation: dispatchReset,
  } = useDashboardState()

  const failed = useCallback(
    (where: string, e: unknown) => {
      const msg = e instanceof Error ? e.message : String(e)
      // viem prefers .shortMessage on its errors; surface that if present.
      const short =
        (e as { shortMessage?: string } | null)?.shortMessage ?? msg.split('\n')[0]
      setTxPhase('error', null, `${where}: ${short}`)
      console.error(`[vault.${where}]`, e)
    },
    [setTxPhase],
  )

  // ── Deploy ───────────────────────────────────────────────────────────
  const deploy = useCallback(async () => {
    if (!address || !assets || assets.vault === ZERO) {
      setTxPhase('error', null, 'Vault not deployed on this chain.')
      return
    }
    if (allocatedCapital <= 0) {
      setTxPhase('error', null, 'Allocated capital must be > 0.')
      return
    }

    const usingEth = selectedAsset === 'ETH'
    const asset: Address = usingEth ? ZERO : assets.usdc
    if (!usingEth && asset === ZERO) {
      setTxPhase('error', null, 'USDC not supported on this chain.')
      return
    }

    const decimals = usingEth ? 18 : assets.usdcDecimals
    const amount = parseUnits(String(allocatedCapital), decimals)
    const riskBps = BigInt(Math.round(riskPerTrade * 100))     // 1.0% -> 100 bps
    const maxDdBps = BigInt(Math.round(maxDrawdownPct * 100))  // 10% -> 1000 bps

    try {
      // For USDC: ensure allowance covers amount. If not, ask user to approve.
      if (!usingEth) {
        setTxPhase('approving')
        const current = (await readContract(config, {
          abi: erc20Abi,
          address: asset,
          functionName: 'allowance',
          args: [address, assets.vault],
          chainId,
        })) as bigint

        if (current < amount) {
          const approveHash = await writeContractAsync({
            abi: erc20Abi,
            address: asset,
            functionName: 'approve',
            args: [assets.vault, amount],
            chainId,
          })
          setTxPhase('pending', approveHash)
          await waitForTransactionReceipt(config, { hash: approveHash, chainId })
        }
      }

      setTxPhase('signing')
      const deployHash = await writeContractAsync({
        abi: agentVaultAbi,
        address: assets.vault,
        functionName: 'deploy',
        args: [asset, amount, riskBps, maxDdBps],
        value: usingEth ? amount : 0n,
        chainId,
      })
      setTxPhase('pending', deployHash)
      await waitForTransactionReceipt(config, { hash: deployHash, chainId })
      setTxPhase('idle', deployHash, null)

      // Only now does the dashboard flip to "active". The 3D agent typing
      // animation and (later) the live data feed react to this dispatch.
      dispatchDeploy()
    } catch (e) {
      failed('deploy', e)
    }
  }, [
    address, assets, chainId, config,
    allocatedCapital, selectedAsset, riskPerTrade, maxDrawdownPct,
    writeContractAsync, setTxPhase, dispatchDeploy, failed,
  ])

  // ── Terminate ────────────────────────────────────────────────────────
  const terminate = useCallback(async () => {
    if (!assets || assets.vault === ZERO) {
      // No on-chain session to close — fall back to local terminate so the UI
      // still resets cleanly from a half-deployed state.
      dispatchTerminate()
      return
    }
    try {
      setTxPhase('signing')
      const hash = await writeContractAsync({
        abi: agentVaultAbi,
        address: assets.vault,
        functionName: 'terminate',
        args: [],
        chainId,
      })
      setTxPhase('pending', hash)
      await waitForTransactionReceipt(config, { hash, chainId })
      setTxPhase('idle', hash, null)
      dispatchTerminate()
    } catch (e) {
      failed('terminate', e)
    }
  }, [assets, chainId, config, writeContractAsync, setTxPhase, dispatchTerminate, failed])

  // ── Pause / Resume ───────────────────────────────────────────────────
  const togglePaused = useCallback(async () => {
    if (!assets || assets.vault === ZERO) {
      dispatchTogglePaused()
      return
    }
    try {
      // Mirror the reducer: paused -> resume, active -> pause.
      const functionName = paused ? 'resume' : 'pause'
      setTxPhase('signing')
      const hash = await writeContractAsync({
        abi: agentVaultAbi,
        address: assets.vault,
        functionName,
        args: [],
        chainId,
      })
      setTxPhase('pending', hash)
      await waitForTransactionReceipt(config, { hash, chainId })
      setTxPhase('idle', hash, null)
      dispatchTogglePaused()
    } catch (e) {
      failed('pause', e)
    }
  }, [assets, chainId, config, paused, writeContractAsync, setTxPhase, dispatchTogglePaused, failed])

  // ── Close trade ──────────────────────────────────────────────────────
  // Settles a trade's PnL on-chain. Loss → vault transfers |pnl| to treasury,
  // user balance shrinks. Win → vault pulls pnl from treasury (USDC) or from
  // the houseEth pool (ETH), user balance grows.
  //
  // `pnl` MUST be in the same raw token units as the deposit asset (wei for
  // ETH, 6dp for USDC, etc.) — not USD-denominated PnL from the UI.
  const closeTrade = useCallback(
    async (id: `0x${string}`, exitPrice: bigint, pnl: bigint, reason: string) => {
      if (!assets || assets.vault === ZERO) {
        setTxPhase('error', null, 'Vault not deployed on this chain.')
        return
      }
      try {
        setTxPhase('signing')
        const hash = await writeContractAsync({
          abi: agentVaultAbi,
          address: assets.vault,
          functionName: 'closeTrade',
          args: [id, exitPrice, pnl, reason],
          chainId,
        })
        setTxPhase('pending', hash)
        await waitForTransactionReceipt(config, { hash, chainId })
        setTxPhase('idle', hash, null)
      } catch (e) {
        failed('closeTrade', e)
      }
    },
    [assets, chainId, config, writeContractAsync, setTxPhase, failed],
  )

  // ── Reset simulation: terminates if a session exists, then wipes UI ──
  const reset = useCallback(async () => {
    try {
      if (assets && assets.vault !== ZERO) {
        // Best-effort terminate; if it fails because no session is active, we
        // still proceed to the local reset so the user isn't stuck.
        try {
          setTxPhase('signing')
          const hash = await writeContractAsync({
            abi: agentVaultAbi,
            address: assets.vault,
            functionName: 'terminate',
            args: [],
            chainId,
          })
          setTxPhase('pending', hash)
          await waitForTransactionReceipt(config, { hash, chainId })
        } catch {
          // ignore — likely no active session on-chain
        }
      }
      setTxPhase('idle', null, null)
      dispatchReset()
    } catch (e) {
      failed('reset', e)
    }
  }, [assets, chainId, config, writeContractAsync, setTxPhase, dispatchReset, failed])

  return { deploy, terminate, togglePaused, reset, closeTrade }
}
