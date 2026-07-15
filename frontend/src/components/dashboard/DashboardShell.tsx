'use client'

import HeaderBar from './HeaderBar'
import AgentViewport from './AgentViewport'
import ReasoningTerminal from './ReasoningTerminal'
import SMCChart from './SMCChart'
import PositionsLedger from './PositionsLedger'
import ControlStrip from './ControlStrip'
import ConfigSidebar from './ConfigSidebar'
import ChainBanner from './ChainBanner'
import AgentStatusBar from './AgentStatusBar'
import { useMockEngine } from '@/hooks/dashboard/useMockEngine'
import { useLiveSMC } from '@/hooks/dashboard/useLiveSMC'

const LIVE_LLM = process.env.NEXT_PUBLIC_LIVE_LLM === '1'

// Always mount the engine — Binance WS fallback means chart is live
// even without a wallet or backend connection.
function EngineMount() {
  useMockEngine()
  return null
}

function LiveSMCMount() {
  useLiveSMC()
  return null
}

export default function DashboardShell() {
  return (
    <main className="relative grid h-screen w-full grid-rows-[52px_auto_auto_minmax(0,1fr)_auto_44px] bg-surface-0 text-ink">
      <EngineMount />
      {LIVE_LLM && <LiveSMCMount />}

      <HeaderBar />
      <ChainBanner />

      {/* Agent status bar — always visible when agent is live */}
      <AgentStatusBar />

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
