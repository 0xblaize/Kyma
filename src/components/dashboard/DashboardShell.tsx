'use client'

import HeaderBar from './HeaderBar'
import AgentViewport from './AgentViewport'
import ReasoningTerminal from './ReasoningTerminal'
import SMCChart from './SMCChart'
import PositionsLedger from './PositionsLedger'
import ControlStrip from './ControlStrip'
import ConfigSidebar from './ConfigSidebar'
import ChainBanner from './ChainBanner'
import { useMockEngine } from '@/hooks/dashboard/useMockEngine'
import { useLiveSMC } from '@/hooks/dashboard/useLiveSMC'

// Real on-chain flow is the default. The synthetic feed only runs when the
// env flag NEXT_PUBLIC_DEMO_FALLBACK=1 is set — useful for offline UI work
// when the user isn't connected to a wallet or has no testnet liquidity.
const DEMO_FALLBACK = process.env.NEXT_PUBLIC_DEMO_FALLBACK === '1'
// When NEXT_PUBLIC_LIVE_LLM=1, /api/smc is polled for real SMC analysis.
// The mock engine still runs in the background to keep the price/portfolio
// feeds alive — the LLM only replaces the SMC reasoning strings.
const LIVE_LLM = process.env.NEXT_PUBLIC_LIVE_LLM === '1'

// Spec §1–§7 layout map:
//   [Header h-16, full width                                           ]
//   [3D Viewport ~58%        | Intel Feeds (Term + Chart)  | Config 320]
//   [Positions & Performance Ledger — full width                       ]
//   [Emergency Action Bar h-14                                         ]
// Tiny shim: conditionally calling a hook violates the Rules of Hooks, but a
// component that's only mounted when the flag is on is fine.
function MockEngineMount() {
  useMockEngine()
  return null
}

function LiveSMCMount() {
  useLiveSMC()
  return null
}

export default function DashboardShell() {
  return (
    <main className="relative grid h-screen w-full grid-rows-[52px_minmax(0,1fr)_auto_44px] bg-surface-0 text-ink">
      {DEMO_FALLBACK && <MockEngineMount />}
      {LIVE_LLM && <LiveSMCMount />}
      <HeaderBar />
      <ChainBanner />

      <section className="grid min-h-0 grid-cols-1 lg:grid-cols-[minmax(0,1.45fr)_minmax(400px,1.25fr)_272px]">
        <AgentViewport />
        <div className="grid min-h-0 grid-rows-[minmax(0,0.8fr)_minmax(0,1.4fr)] border-l border-line">
          <ReasoningTerminal />
          <SMCChart />
        </div>
        <ConfigSidebar />
      </section>

      <PositionsLedger />
      <ControlStrip />
    </main>
  )
}
