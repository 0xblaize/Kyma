'use client'

import { Suspense } from 'react'
import { Canvas } from '@react-three/fiber'
import * as THREE from 'three'
import type { AgentState } from '@/lib/clips'
import DashboardAgentScene from './DashboardAgentScene'

interface Props {
  state: AgentState
  screenGlow: number
}

export default function DashboardAgentCanvas({ state, screenGlow }: Props) {
  return (
    <Canvas
      shadows
      dpr={[1, 1.5]}
      camera={{ position: [2.6, 1.85, 2.6], fov: 36 }}
      gl={{
        antialias: true,
        toneMapping: THREE.ACESFilmicToneMapping,
        powerPreference: 'high-performance',
      }}
      style={{ position: 'absolute', inset: 0 }}
    >
      <Suspense fallback={null}>
        <DashboardAgentScene state={state} screenGlow={screenGlow} />
      </Suspense>
    </Canvas>
  )
}
