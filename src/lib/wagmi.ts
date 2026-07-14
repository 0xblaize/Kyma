import { http, createConfig, fallback } from 'wagmi'
import { baseSepolia } from 'wagmi/chains'
// import { sepolia, bscTestnet, morphHolesky } from 'wagmi/chains' // disabled — Base Sepolia only for v1
import { injected, walletConnect } from 'wagmi/connectors'
import type { Address } from 'viem'

// WalletConnect Cloud project id — required by WC v2. Get one (free) at
// https://cloud.walletconnect.com and put it in `.env.local`:
//   NEXT_PUBLIC_WC_PROJECT_ID=...
// If absent, we silently drop the WC connector and ship injected-only.
const WC_PROJECT_ID = process.env.NEXT_PUBLIC_WC_PROJECT_ID

const connectors = [
  injected({ shimDisconnect: true }),
  ...(WC_PROJECT_ID
    ? [
        walletConnect({
          projectId: WC_PROJECT_ID,
          showQrModal: true,
          metadata: {
<<<<<<< HEAD
            name: 'Kyma',
            description: 'Autonomous trading intelligence',
            url: typeof window !== 'undefined' ? window.location.origin : 'https://kyma.terminal',
            icons: ['https://avatars.githubusercontent.com/u/37784886'],
=======
            name: 'Agent.OS',
            description: 'Autonomous trading intelligence',
            url: typeof window !== 'undefined' ? window.location.origin : 'https://agent.os',
            icons: [],
>>>>>>> 329e9be2135d833cd4216995a8008f2985cca82d
          },
        }),
      ]
    : []),
]

// Per-chain RPC overrides (optional; public default used otherwise).
const RPC = {
  baseSepolia: process.env.NEXT_PUBLIC_BASE_SEPOLIA_RPC,
  // sepolia: process.env.NEXT_PUBLIC_SEPOLIA_RPC,
  // bscTestnet: process.env.NEXT_PUBLIC_BSC_TESTNET_RPC,
  // morphHolesky: process.env.NEXT_PUBLIC_MORPH_HOLESKY_RPC,
} as const

const transportFor = (custom: string | undefined) =>
  custom ? fallback([http(custom), http()]) : http()

// v1 is single-chain (Base Sepolia). Re-add the others by uncommenting the
// imports above, the entries here, and the CHAIN_ASSETS rows below.
export const supportedChains = [baseSepolia] as const

export const wagmiConfig = createConfig({
  chains: supportedChains,
  connectors,
  transports: {
    [baseSepolia.id]: transportFor(RPC.baseSepolia),
    // [sepolia.id]: transportFor(RPC.sepolia),
    // [bscTestnet.id]: transportFor(RPC.bscTestnet),
    // [morphHolesky.id]: transportFor(RPC.morphHolesky),
  },
  ssr: false,
})

// Back-compat re-export; old code imported a singleton.
export const supportedChain = baseSepolia

// ─────────────────────────────────────────────────────────────────────────
// Per-chain addresses: USDC (ERC20) + AgentVault (deployed by user).
// USDC addresses are well-known testnet faucet tokens. Vault addresses are
// supplied via env — leave 0x000…000 to disable that chain's deploy button.
// ─────────────────────────────────────────────────────────────────────────

const ZERO: Address = '0x0000000000000000000000000000000000000000'

type ChainAssets = {
  label: string
  shortLabel: string
  explorer: string
  usdc: Address          // ZERO means USDC not supported on this chain
  usdcDecimals: number
  vault: Address         // ZERO means vault not deployed on this chain yet
}

export const CHAIN_ASSETS: Record<number, ChainAssets> = {
  [baseSepolia.id]: {
    label: 'Base Sepolia',
    shortLabel: 'Base',
    explorer: 'https://sepolia.basescan.org',
    // Circle's official Base Sepolia USDC, 6 decimals. Faucet: https://faucet.circle.com
    usdc: '0x036CbD53842c5426634e7929541eC2318f3dCF7e' as Address,
    usdcDecimals: 6,
    vault: (process.env.NEXT_PUBLIC_VAULT_BASE_SEPOLIA as Address | undefined) ?? ZERO,
  },
  // ── Disabled for v1 — uncomment to reactivate ────────────────────────────
  // [sepolia.id]: {
  //   label: 'Ethereum Sepolia',
  //   shortLabel: 'Sepolia',
  //   explorer: 'https://sepolia.etherscan.io',
  //   usdc: '0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238' as Address,
  //   usdcDecimals: 6,
  //   vault: (process.env.NEXT_PUBLIC_VAULT_SEPOLIA as Address | undefined) ?? ZERO,
  // },
  // [bscTestnet.id]: {
  //   label: 'BNB Chain Testnet',
  //   shortLabel: 'BNB',
  //   explorer: 'https://testnet.bscscan.com',
  //   usdc: '0x64544969ed7EBf5f083679233325356EbE738930' as Address,
  //   usdcDecimals: 18, // some BSC testnet USDCs use 18 decimals — verify with the faucet you use
  //   vault: (process.env.NEXT_PUBLIC_VAULT_BSC_TESTNET as Address | undefined) ?? ZERO,
  // },
  // [morphHolesky.id]: {
  //   label: 'Morph Holesky',
  //   shortLabel: 'Morph',
  //   explorer: 'https://explorer-holesky.morphl2.io',
  //   usdc: ZERO,           // no canonical USDC on Morph Holesky yet
  //   usdcDecimals: 6,
  //   vault: (process.env.NEXT_PUBLIC_VAULT_MORPH_HOLESKY as Address | undefined) ?? ZERO,
  // },
}

export function chainAssets(chainId: number | undefined): ChainAssets | undefined {
  if (chainId == null) return undefined
  return CHAIN_ASSETS[chainId]
}

export function isVaultDeployed(chainId: number | undefined): boolean {
  const a = chainAssets(chainId)
  return !!a && a.vault !== ZERO
}

export function isUsdcSupported(chainId: number | undefined): boolean {
  const a = chainAssets(chainId)
  return !!a && a.usdc !== ZERO
}
