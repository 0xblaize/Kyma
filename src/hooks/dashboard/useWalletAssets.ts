'use client'

import { useMemo } from 'react'
import { useAccount, useBalance, useChainId, useReadContract } from 'wagmi'
import { formatUnits, type Address } from 'viem'
import { chainAssets, isUsdcSupported } from '@/lib/wagmi'
import { erc20Abi } from '@/lib/vaultAbi'

export type AssetSymbol = 'ETH' | 'USDC'

export interface AssetBalance {
  symbol: AssetSymbol
  raw: bigint                 // smallest unit (wei or 6-dec USDC)
  decimals: number
  formatted: string           // human-readable, fixed precision per asset
  supported: boolean          // false if not deployed on this chain
}

interface UseWalletAssetsResult {
  eth: AssetBalance
  usdc: AssetBalance
  chainId: number
  chainLabel: string
  isConnected: boolean
  isLoading: boolean
  // Reading the same balance by symbol — used by inputs and the equity tile.
  byAsset: (a: AssetSymbol) => AssetBalance
}

// Native gas symbol differs per chain (ETH, BNB) but we always surface it as
// "ETH" in the toggle for label brevity — the chain badge tells the user which.
function nativeDisplaySymbol(chainId: number): AssetSymbol {
  return 'ETH'
}

function fmt(raw: bigint, decimals: number, precision: number): string {
  if (raw === 0n) return '0'
  const s = formatUnits(raw, decimals)
  const n = Number(s)
  if (!Number.isFinite(n)) return s
  return n.toLocaleString(undefined, {
    minimumFractionDigits: 0,
    maximumFractionDigits: precision,
  })
}

export function useWalletAssets(): UseWalletAssetsResult {
  const { address, isConnected } = useAccount()
  const chainId = useChainId()
  const assets = chainAssets(chainId)

  // Native ETH/BNB balance. wagmi polls on block by default.
  const ethQ = useBalance({
    address,
    chainId,
    query: { enabled: !!address, refetchInterval: 8_000 },
  })

  // USDC balanceOf — only if the chain has a known USDC address.
  const usdcQ = useReadContract({
    abi: erc20Abi,
    address: assets?.usdc as Address | undefined,
    functionName: 'balanceOf',
    args: address ? [address] : undefined,
    chainId,
    query: {
      enabled: !!address && !!assets && isUsdcSupported(chainId),
      refetchInterval: 8_000,
    },
  })

  return useMemo<UseWalletAssetsResult>(() => {
    const ethRaw = (ethQ.data?.value as bigint | undefined) ?? 0n
    const ethDecimals = ethQ.data?.decimals ?? 18

    const usdcRaw = (usdcQ.data as bigint | undefined) ?? 0n
    const usdcDecimals = assets?.usdcDecimals ?? 6
    const usdcSupported = isUsdcSupported(chainId)

    const eth: AssetBalance = {
      symbol: nativeDisplaySymbol(chainId),
      raw: ethRaw,
      decimals: ethDecimals,
      formatted: fmt(ethRaw, ethDecimals, 4),
      supported: true,
    }

    const usdc: AssetBalance = {
      symbol: 'USDC',
      raw: usdcRaw,
      decimals: usdcDecimals,
      formatted: usdcSupported ? fmt(usdcRaw, usdcDecimals, 2) : '—',
      supported: usdcSupported,
    }

    return {
      eth,
      usdc,
      chainId: chainId ?? 0,
      chainLabel: assets?.shortLabel ?? 'Unknown',
      isConnected: !!isConnected,
      isLoading: ethQ.isLoading || usdcQ.isLoading,
      byAsset: (a) => (a === 'ETH' ? eth : usdc),
    }
  }, [
    chainId,
    assets,
    isConnected,
    ethQ.data,
    ethQ.isLoading,
    usdcQ.data,
    usdcQ.isLoading,
  ])
}
