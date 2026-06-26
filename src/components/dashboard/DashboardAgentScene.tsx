'use client'

import { useEffect, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { ContactShadows, Environment } from '@react-three/drei'
import * as THREE from 'three'
import DashboardAgentModel from './DashboardAgentModel'
import type { AgentState } from '@/lib/clips'

interface Props {
  state: AgentState
  screenGlow: number
}

// ── A standalone scene tuned for the dashboard viewport ──
// Unlike the landing-page rig (staircase + walk + chair across a long floor),
// this scene puts the agent dead-center at the chair with the camera already
// framed on them. No lerps, no journey — the character is ON SCREEN the moment
// the panel mounts. Includes a minimal desk/monitor block so the scene reads
// as "agent at their workstation" without the full apartment rig.

function MiniDesk({ glow }: { glow: number }) {
  return (
    <group position={[0, 0, 1.05]}>
      {/* desk top */}
      <mesh position={[0, 1.02, 0]} castShadow receiveShadow>
        <boxGeometry args={[2.2, 0.06, 0.8]} />
        <meshStandardMaterial color="#0f1218" metalness={0.55} roughness={0.45} />
      </mesh>
      {/* desk frame */}
      {[-0.95, 0.95].map((x) => (
        <mesh key={x} position={[x, 0.52, 0]} castShadow>
          <boxGeometry args={[0.06, 1.0, 0.66]} />
          <meshStandardMaterial color="#0a0c11" metalness={0.7} roughness={0.35} />
        </mesh>
      ))}
      {/* Triple monitors.
          The agent sits at the chair (z=0) facing +Z. The desk is at +Z 1.05,
          so monitors live INSIDE the desk group at desk-local z=-0.12
          (i.e. on the chair-facing edge of the desk). Screens must face -Z
          so the mannequin reads them.

          Math.PI on the Y rotation flips the monitor group 180° so the
          planeGeometry's outward normal (+Z by default) ends up pointing
          world -Z toward the chair. The +x*0.28 toe-in then angles the
          side monitors inward toward where the agent's eyes sit. */}
      {[-0.74, 0, 0.74].map((x, i) => (
        <group key={i} position={[x, 1.52, -0.12]} rotation={[0, Math.PI + x * 0.28, 0]}>
          <mesh castShadow>
            <boxGeometry args={[0.7, 0.42, 0.04]} />
            <meshStandardMaterial color="#05060a" metalness={0.5} roughness={0.4} />
          </mesh>
          <mesh position={[0, 0, 0.025]}>
            <planeGeometry args={[0.64, 0.36]} />
            <meshStandardMaterial
              color="#0a1a14"
              emissive="#86efac"
              emissiveIntensity={0.18 + glow * 0.55}
              toneMapped={false}
            />
          </mesh>
          <mesh position={[0, -0.32, 0]}>
            <boxGeometry args={[0.08, 0.22, 0.06]} />
            <meshStandardMaterial color="#0a0c11" metalness={0.8} roughness={0.3} />
          </mesh>
        </group>
      ))}
      {/* Keyboard sits on the NEAR edge of the desk (chair side), not the
          far edge. Desk frame -Z = toward agent. */}
      <mesh position={[0, 1.07, -0.28]} castShadow>
        <boxGeometry args={[0.7, 0.025, 0.18]} />
        <meshStandardMaterial color="#0a0c11" metalness={0.6} roughness={0.4} />
      </mesh>
      {/* Screen fill light — placed on the chair side of the monitors so the
          green spill lands on the agent's face, not into the void behind. */}
      <pointLight position={[0, 1.55, -0.4]} color="#a7f3d0" intensity={glow * 1.6} distance={3.4} />
    </group>
  )
}

function Chair() {
  const DARK = { color: '#0a0c11', metalness: 0.75, roughness: 0.3 }
  return (
    <group>
      <mesh position={[0, 0.55, 0]} castShadow receiveShadow>
        <boxGeometry args={[0.62, 0.16, 0.6]} />
        <meshStandardMaterial {...DARK} />
      </mesh>
      <mesh position={[0, 1.18, -0.32]} rotation={[-0.1, 0, 0]} castShadow>
        <boxGeometry args={[0.62, 1.05, 0.14]} />
        <meshStandardMaterial {...DARK} />
      </mesh>
      <mesh position={[0, 1.78, -0.28]} rotation={[-0.1, 0, 0]} castShadow>
        <boxGeometry args={[0.46, 0.26, 0.14]} />
        <meshStandardMaterial {...DARK} />
      </mesh>
      {[-0.4, 0.4].map((x) => (
        <mesh key={x} position={[x, 0.82, 0]} castShadow>
          <boxGeometry args={[0.1, 0.1, 0.42]} />
          <meshStandardMaterial {...DARK} />
        </mesh>
      ))}
      <mesh position={[0, 0.3, 0]} castShadow>
        <cylinderGeometry args={[0.05, 0.05, 0.46, 12]} />
        <meshStandardMaterial color="#181c25" metalness={0.85} roughness={0.25} />
      </mesh>
    </group>
  )
}

export default function DashboardAgentScene({ state, screenGlow }: Props) {
  const { camera } = useThree()
  const ref = useRef<THREE.Group>(null)

  // Frame the camera once on mount — close three-quarter shot of the seated
  // agent with both the body and the monitors in view.
  useEffect(() => {
    camera.position.set(2.6, 1.85, 2.6)
    camera.lookAt(0, 1.15, 0.2)
  }, [camera])

  // Subtle breathing pan so the shot doesn't feel static.
  useFrame(({ clock }) => {
    const t = clock.getElapsedTime()
    const x = 2.5 + Math.sin(t * 0.25) * 0.18
    const y = 1.85 + Math.sin(t * 0.18) * 0.04
    camera.position.lerp(new THREE.Vector3(x, y, 2.6), 0.04)
    camera.lookAt(0, 1.15, 0.2)
  })

  return (
    <>
      <color attach="background" args={['#09090b']} />
      <fog attach="fog" args={['#09090b', 5, 14]} />

      {/* Lighting tuned so the agent reads cleanly without harsh acid spill. */}
      <ambientLight intensity={0.35} />
      <directionalLight
        position={[3, 6, 4]}
        intensity={1.3}
        color="#fff1e0"
        castShadow
        shadow-mapSize={[1024, 1024]}
      />
      <pointLight position={[-2.5, 2.4, 2]} intensity={5} color="#7dd3fc" distance={8} />
      <pointLight position={[0, 1.6, 1.6]} intensity={4} color="#a7f3d0" distance={4} />
      <Environment preset="city" />

      <Chair />
      <MiniDesk glow={screenGlow} />

      {/* Agent group y matches the chair seat MESH CENTER (0.55) — mirrors the
          pattern in AgentScene.tsx where the seated agent group lifts to
          SEAT_POS.y + 0.5 (seat-center). The sit_idle clip's hip offset then
          drops the hips onto the seat cushion rather than the backrest. */}
      <group ref={ref} position={[0, 0.55, 0]} rotation={[0, 0, 0]}>
        <DashboardAgentModel state={state} targetHeight={1.55} />
      </group>

      {/* Soft floor with a contact shadow under the rig. */}
      <ContactShadows position={[0, 0, 0]} opacity={0.55} scale={8} blur={2.4} far={3} />
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]} receiveShadow>
        <planeGeometry args={[14, 14]} />
        <meshStandardMaterial color="#080a0f" metalness={0.35} roughness={0.7} />
      </mesh>
    </>
  )
}
