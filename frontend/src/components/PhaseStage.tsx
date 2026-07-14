'use client'

import dynamic from 'next/dynamic'
import { PHASES } from '@/lib/phases'

// One canvas, mounted from the start and never torn down. Earlier the page
// ran TWO Canvases simultaneously (HeroCanvas + AgentCanvas) and remounted the
// agent one every time the scroll phase crossed `morph` — Windows GPUs ran out
// of WebGL context slots and silently killed the agent context, which is why
// the character vanished after the box reveal. The box and the character now
// share a single context inside AgentScene.
const AgentCanvas = dynamic(() => import('@/components/AgentCanvas'), { ssr: false })

interface PhaseStageProps {
  phase: number
  phaseProgress: number
}

export default function PhaseStage({ phase, phaseProgress }: PhaseStageProps) {
  return (
    <div className="absolute inset-0 z-10">
      <div className="absolute inset-0 bg-black" />
      <div className="absolute inset-0">
        <AgentCanvas phase={phase} phaseProgress={phaseProgress} />
      </div>
      <div className="pointer-events-none absolute bottom-4 left-4 font-mono text-[9px] uppercase tracking-[0.3em] text-acid/30">
        {PHASES[phase]?.id} · {(phaseProgress * 100).toFixed(0)}%
      </div>
    </div>
  )
}
