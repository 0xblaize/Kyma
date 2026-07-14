'use client'

import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { Billboard, Text } from '@react-three/drei'
import * as THREE from 'three'

interface ThoughtCloudProps {
  /** 0 = hidden, 1 = fully formed. The cloud scales/fades with this. */
  show: number
  /** World position of the agent's head to anchor above. */
  headY?: number
}

const SIGNALS = [
  'BTC  64,200',
  'BOS · bullish',
]

// White puffy cloud built from overlapping circles (billboarded). Tuned small
// so it reads as a comic "thought bubble" floating just above the head, like a
// classic thought-bubble illustration — NOT a big dark disc.
const PUFFS: { x: number; y: number; r: number }[] = [
  { x: -0.5, y: 0.05, r: 0.32 },
  { x: -0.2, y: 0.22, r: 0.38 },
  { x: 0.18, y: 0.24, r: 0.36 },
  { x: 0.52, y: 0.06, r: 0.32 },
  { x: -0.36, y: -0.18, r: 0.3 },
  { x: 0.04, y: -0.1, r: 0.42 },
  { x: 0.4, y: -0.2, r: 0.3 },
]

// The little trailing puffs that connect the bubble down to the head.
const TRAIL: { x: number; y: number; r: number }[] = [
  { x: -0.28, y: -0.62, r: 0.13 },
  { x: -0.42, y: -0.92, r: 0.09 },
]

const WHITE = '#f4f6f2'

/**
 * A small white "thinking" cloud above the agent's head showing the BTC signal
 * it's reasoning about before walking to the desk. Billboarded 2D-in-3D — a
 * cluster of white puffs (the bubble) + a short trail of small puffs.
 */
export default function ThoughtCloud({ show, headY = 1.8 }: ThoughtCloudProps) {
  const group = useRef<THREE.Group>(null)

  useFrame((state) => {
    if (!group.current) return
    const t = state.clock.elapsedTime
    // Small bubble pinned to the right of the head, very close — the trail
    // puffs (down-left in local coords) lean back toward the head.
    group.current.scale.setScalar(THREE.MathUtils.lerp(0.28, 0.4, show))
    group.current.position.y = headY + 0.35 + Math.sin(t * 0.9) * 0.02
    group.current.position.x = 0.55
  })

  if (show <= 0.01) return null
  const op = Math.min(1, show)

  return (
    <Billboard ref={group}>
      {/* trailing connector puffs (down toward the head) */}
      {TRAIL.map((c, i) => (
        <mesh key={`t${i}`} position={[c.x, c.y, -0.002]}>
          <circleGeometry args={[c.r, 24]} />
          <meshBasicMaterial color={WHITE} transparent opacity={0.96 * op} />
        </mesh>
      ))}

      {/* soft grey under-shadow so the white puffs read against the dark scene */}
      {PUFFS.map((c, i) => (
        <mesh key={`s${i}`} position={[c.x + 0.015, c.y - 0.02, -0.003]}>
          <circleGeometry args={[c.r * 1.04, 28]} />
          <meshBasicMaterial color="#9aa0a6" transparent opacity={0.45 * op} />
        </mesh>
      ))}

      {/* the white cloud body */}
      {PUFFS.map((c, i) => (
        <mesh key={`p${i}`} position={[c.x, c.y, 0]}>
          <circleGeometry args={[c.r, 28]} />
          <meshBasicMaterial color={WHITE} transparent opacity={0.98 * op} />
        </mesh>
      ))}

      {/* signal lines — dark text on the white bubble. No header any more;
          the bubble itself reads as "thinking" and the two short lines fit. */}
      {SIGNALS.map((line, i) => (
        <Text
          key={i}
          position={[0, 0.1 - i * 0.18, 0.02]}
          fontSize={0.13}
          color="#15181d"
          anchorX="center"
          fillOpacity={op * Math.min(1, Math.max(0, show * SIGNALS.length - i))}
        >
          {line}
        </Text>
      ))}
    </Billboard>
  )
}
