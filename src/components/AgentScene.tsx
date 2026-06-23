'use client'

import { Suspense, useMemo, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { Environment } from '@react-three/drei'
import * as THREE from 'three'
import { PHASE } from '@/lib/phases'
import { AgentState } from '@/lib/clips'
import AgentModel from './AgentModel'
import ThoughtCloud from './ThoughtCloud'
import HeroBox from './HeroBox'
import Staircase, {
  stairPoint,
  STAIR_TOP,
  STAIR_BOTTOM,
  PODIUM_HEIGHT,
} from './Staircase'
import DeskRig, { SEAT_POS } from './DeskRig'

interface AgentSceneProps {
  phase: number
  phaseProgress: number
}

// Body center of the agent when standing on the pavement. We frame both the
// hero box (during intro) and the character (during morph) around this point
// — the camera never tilts down to the floor or peeks behind the podium.
const PODIUM_BODY_Y = PODIUM_HEIGHT + 0.9
const PODIUM_TOP_FOCUS = new THREE.Vector3(0, PODIUM_BODY_Y, 0)

/**
 * Per-phase camera offset relative to the focus point.
 *  - intro / morph: directly in front at body height — fixed full-body view of
 *    the pavement and whatever sits on it (box, then character). Stationary.
 *  - data:  pulled out to the side as the agent walks toward the desk.
 *  - later: 3/4 over-shoulder view at the desk.
 */
function cameraOffsetForPhase(phase: number): THREE.Vector3 {
  if (phase <= PHASE.morph) return new THREE.Vector3(0, 0.0, 4.8)
  if (phase === PHASE.data) return new THREE.Vector3(4.2, 1.4, 2.4)
  return new THREE.Vector3(2.6, 1.6, 3.4)
}

/**
 * Which way the agent should be facing, in radians around Y.
 *  - intro / morph: face the camera so the user sees the front of the
 *    mannequin with the thought cloud above its head.
 *  - data → seated: face the desk so the walk and sit read naturally.
 */
function facingForPhase(phase: number): number {
  if (phase <= PHASE.morph) return Math.PI
  return 0
}

function stateForPhase(phase: number): AgentState {
  switch (phase) {
    case PHASE.intro:
    case PHASE.morph:
      // Calm standing breath the whole time the character is on the podium —
      // no thinking-clip switch (which was just an alias for stand_idle and
      // briefly showed bind-pose on the swap).
      return 'stand_idle'
    case PHASE.data:
      return 'walk'
    case PHASE.shadows:
      return 'sit_down'
    case PHASE.fusion:
      return 'typing'
    case PHASE.cta:
    default:
      return 'sit_idle'
  }
}

function walkProgress(phase: number, p: number): number {
  if (phase <= PHASE.morph) return 0
  if (phase === PHASE.data) return p
  return 1
}

// Descent path for the data phase. First slice = drop straight off the
// podium to the ground; remainder = walk along the floor to the seat. The
// pavement→ground transition is intentionally simple; we iterate on it once
// the on-podium reveal reads correctly.
const DROP_FRAC = 0.35

function journeyPoint(w: number, out: THREE.Vector3): THREE.Vector3 {
  if (w <= DROP_FRAC) return stairPoint(w / DROP_FRAC, out)
  const f = (w - DROP_FRAC) / (1 - DROP_FRAC)
  return out.lerpVectors(STAIR_BOTTOM, SEAT_POS, f)
}

function thoughtShow(phase: number, p: number): number {
  // Cloud only appears AFTER the character is revealed — fades in once the
  // box is fully gone, holds, then fades out at the end of morph.
  if (phase !== PHASE.morph) return 0
  if (p < 0.45) return 0
  if (p < 0.6) return (p - 0.45) / 0.15
  if (p > 0.9) return Math.max(0, 1 - (p - 0.9) / 0.1)
  return 1
}

export default function AgentScene({ phase, phaseProgress }: AgentSceneProps) {
  const { camera } = useThree()
  const agentRef = useRef<THREE.Group>(null)
  const tmp = useMemo(() => new THREE.Vector3(), [])
  const tmp2 = useMemo(() => new THREE.Vector3(), [])
  const lookTarget = useMemo(() => new THREE.Vector3(), [])

  const state = stateForPhase(phase)
  const seated = phase >= PHASE.shadows
  const screenGlow = phase === PHASE.fusion ? 1 : phase > PHASE.fusion ? 0.5 : 0
  const cloud = thoughtShow(phase, phaseProgress)

  // Hero box drive: small drift during intro, then a 0→1 burst across morph.
  const heroExplode =
    phase === PHASE.intro
      ? phaseProgress * 0.1
      : phase === PHASE.morph
        ? 0.1 + phaseProgress * 0.9
        : 1
  // Box is gone once it has fully shattered (~halfway through morph) so the
  // character can occupy the pavement cleanly.
  const heroVisible = phase < PHASE.morph || (phase === PHASE.morph && phaseProgress < 0.45)

  // World visibility: podium + character mount at morph start so the box
  // bursts and reveals the character standing in place.
  const worldVisible = phase >= PHASE.morph

  // Ground plane stays hidden during morph — the pavement is meant to read as
  // a floating island in the dark. It comes in when the agent walks down.
  const groundVisible = phase > PHASE.morph
  // Same for the desk rig — during morph the only things in view should be
  // the pavement, the breaking box, and the character standing on top.
  const deskVisible = phase > PHASE.morph

  useFrame(() => {
    // Camera focus point. Until the agent is on the descent (data phase) we
    // always look at the podium top — this is the only place anything is
    // happening (box bouncing, then bursting, then character revealed).
    let focus: THREE.Vector3
    if (seated) focus = SEAT_POS
    else if (phase <= PHASE.morph) focus = PODIUM_TOP_FOCUS
    else focus = agentRef.current?.position ?? STAIR_BOTTOM

    const off = cameraOffsetForPhase(phase)
    tmp2.set(focus.x + off.x, focus.y + off.y, focus.z + off.z)
    // PODIUM_TOP_FOCUS is already at body center; the seat/feet focuses for
    // other phases need a body-height nudge so the camera doesn't aim at the
    // floor / under the chair.
    const lookYAdj = phase <= PHASE.morph ? 0 : 0.9
    lookTarget.set(focus.x, focus.y + lookYAdj, focus.z)

    camera.position.lerp(tmp2, 0.1)
    camera.lookAt(lookTarget.x, lookTarget.y, lookTarget.z)

    // Agent transform — only meaningful once the agent group has mounted.
    const g = agentRef.current
    if (!g) return

    if (seated) {
      g.position.lerp(SEAT_POS, 0.15)
    } else {
      const w = walkProgress(phase, phaseProgress)
      journeyPoint(w, tmp)
      g.position.lerp(tmp, 0.2)
    }

    const targetRotY = facingForPhase(phase)
    g.rotation.y = THREE.MathUtils.lerp(g.rotation.y, targetRotY, 0.15)
  })

  return (
    <>
      <color attach="background" args={['#000000']} />
      <fog attach="fog" args={['#000000', 6, 18]} />
      <ambientLight intensity={0.12} color="#2a2f3a" />

      {/* Key light — cool neutral, comes from above-front, lights the top of
          the podium and the character. Used in all phases. */}
      <spotLight
        position={[0, PODIUM_HEIGHT + 6, 4]}
        target-position={[0, PODIUM_BODY_Y, 0]}
        angle={0.55}
        penumbra={0.85}
        intensity={140}
        color="#cfd6e0"
        distance={28}
        castShadow
        shadow-mapSize={[512, 512]}
        shadow-bias={-0.0002}
      />
      {/* Rim from behind — pale cool tone, separates the black character
          from the black background. */}
      <spotLight
        position={[-3, PODIUM_HEIGHT + 3, -4]}
        target-position={[0, PODIUM_BODY_Y, 0]}
        angle={0.6}
        penumbra={1}
        intensity={60}
        color="#7fa4c8"
        distance={20}
      />

      {worldVisible && (
        <Suspense fallback={null}>
          <Environment preset="night" />
        </Suspense>
      )}

      {/* Hero box now lives ON the podium so it bursts where the character
          will be revealed. */}
      <group position={[0, PODIUM_BODY_Y, 0]}>
        <HeroBox explodeProgress={heroExplode} visible={heroVisible} />
      </group>

      {worldVisible && (
        <>
          <Staircase />
          {deskVisible && <DeskRig screenGlow={screenGlow} />}

          <group
            ref={agentRef}
            position={[STAIR_TOP.x, STAIR_TOP.y, STAIR_TOP.z]}
            rotation={[0, Math.PI, 0]}
            scale={1.0}
          >
            <AgentModel state={state} />
            <ThoughtCloud show={cloud} />
          </group>

          {groundVisible && (
            <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.01, -1]} receiveShadow>
              <planeGeometry args={[40, 40]} />
              <meshStandardMaterial color="#05060a" metalness={0.4} roughness={0.8} />
            </mesh>
          )}
        </>
      )}
    </>
  )
}
