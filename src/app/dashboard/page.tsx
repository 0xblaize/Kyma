'use client'

import dynamic from 'next/dynamic'
import { DashboardProvider } from '@/hooks/dashboard/useDashboardState'
import Web3Provider from '@/providers/Web3Provider'

// The dashboard is fully interactive (3D canvas, lightweight-charts, wallet
// connectors that touch window.ethereum). Rendering on the server produces a
// different HTML than the client's first paint and causes hydration errors,
// so we skip SSR for the whole subtree.
const DashboardShell = dynamic(() => import('@/components/dashboard/DashboardShell'), {
  ssr: false,
  loading: () => (
    <div className="flex h-screen w-full items-center justify-center bg-surface-0">
      <span className="font-mono text-[10px] uppercase tracking-[0.4em] text-acid/70">
<<<<<<< HEAD
        booting kyma…
=======
        booting agent.os…
>>>>>>> 329e9be2135d833cd4216995a8008f2985cca82d
      </span>
    </div>
  ),
})

export default function DashboardPage() {
  return (
    <Web3Provider>
      <DashboardProvider>
        <DashboardShell />
      </DashboardProvider>
    </Web3Provider>
  )
}
