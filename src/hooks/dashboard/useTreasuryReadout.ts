'use client'

import { useEffect, useState } from 'react'
import { useChainId, useConfig } from 'wagmi'
import { readContract } from 'wagmi/actions'
import { formatUnits, type Address } from 'viem'
import { chainAssets, isVaultDeployed } from '@/lib/wagmi'
import { agentVaultAbi, erc20Abi } from '@/lib/vaultAbi'

// Live readout of where settlement funds flow on the current chain. The vault
// exposes `treasury` (the loss sink + win source) and `houseEth` (pre-funded
// ETH liquidity for ETH wins). For USDC wins we look up the treasury's
// allowance to the vault — that's how much USDC the pump can pay out.
export interface TreasuryReadout {
  treasury?: Address
  houseEthFormatted: string
  usdcPumpFormatted: string
  usdcSymbol: string
  available: boolean
}

const ZERO: Address = '0x0000000000000000000000000000000000000000'

export function useTreasuryReadout(): TreasuryReadout {
  const chainId = useChainId()
  const config = useConfig()
  const assets = chainAssets(chainId)
  const vaultLive = isVaultDeployed(chainId)

  const [treasury, setTreasury] = useState<Address | undefined>(undefined)
  const [houseEth, setHouseEth] = useState<bigint>(0n)
  const [usdcPump, setUsdcPump] = useState<bigint>(0n)

  useEffect(() => {
    if (!assets || !vaultLive) {
      setTreasury(undefined)
      setHouseEth(0n)
      setUsdcPump(0n)
      return
    }

    let cancelled = false

    const refresh = async () => {
      try {
        const t = (await readContract(config, {
          abi: agentVaultAbi,
          address: assets.vault,
          functionName: 'treasury',
          chainId,
        })) as Address
        const eth = (await readContract(config, {
          abi: agentVaultAbi,
          address: assets.vault,
          functionName: 'houseEth',
          chainId,
        })) as bigint

        let pump = 0n
        if (assets.usdc !== ZERO && t !== ZERO) {
          pump = (await readContract(config, {
            abi: erc20Abi,
            address: assets.usdc,
            functionName: 'allowance',
            args: [t, assets.vault],
            chainId,
          })) as bigint
        }

        if (!cancelled) {
          setTreasury(t)
          setHouseEth(eth)
          setUsdcPump(pump)
        }
      } catch {
        // Vault probably not the new ABI version yet — fail quietly so the
        // dashboard stays usable against an older deployment.
        if (!cancelled) {
          setTreasury(undefined)
          setHouseEth(0n)
          setUsdcPump(0n)
        }
      }
    }

    void refresh()
    const id = setInterval(refresh, 20_000)
    return () => {
      cancelled = true
      clearInterval(id)
    }
  }, [config, chainId, assets, vaultLive])

  const fmt = (v: bigint, decimals: number) => {
    const s = formatUnits(v, decimals)
    const n = Number(s)
    if (!Number.isFinite(n)) return s
    if (n === 0) return '0'
    if (n < 0.001) return n.toExponential(2)
    return n.toLocaleString(undefined, { maximumFractionDigits: 4 })
  }

  return {
    treasury,
    houseEthFormatted: fmt(houseEth, 18),
    usdcPumpFormatted: fmt(usdcPump, assets?.usdcDecimals ?? 6),
    usdcSymbol: 'USDC',
    available: Boolean(treasury && treasury !== ZERO),
  }
}
