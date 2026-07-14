'use client'

import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'

interface FragmentProps {
  startPos: THREE.Vector3
  endPos: THREE.Vector3
  startRot: THREE.Euler
  progress: number
}

function Fragment({ startPos, endPos, startRot, progress }: FragmentProps) {
  const eased =
    progress < 0.5
      ? 4 * progress * progress * progress
      : 1 - Math.pow(-2 * progress + 2, 3) / 2
  const pos = startPos.clone().lerp(endPos, eased)
  const opacity = Math.max(0, 1 - eased * 1.4)

  return (
    <mesh
      position={[pos.x, pos.y, pos.z]}
      rotation={[startRot.x + eased * 2, startRot.y + eased * 3, startRot.z + eased]}
    >
      <boxGeometry args={[0.18, 0.18, 0.06]} />
      <meshStandardMaterial
        color="#1a8fff"
        metalness={0.9}
        roughness={0.1}
        transparent
        opacity={opacity}
        emissive="#004488"
        emissiveIntensity={0.8}
      />
    </mesh>
  )
}

interface HeroBoxProps {
  /** 0 during intro, 0→1 over the morph as the box snaps + bursts. */
  explodeProgress: number
  /** When false the box is unmounted entirely (post-morph). */
  visible: boolean
}

/**
 * The blue "agent core" box — bounces DVD-style during intro, snaps to the
 * world origin and shatters as the morph reveals the character. Lives inside
 * the main AgentScene canvas (NOT its own Canvas) so the page only ever holds
 * one WebGL context — two contexts were exhausting the GPU and getting killed
 * by the browser, which is why the character disappeared after the reveal.
 */
export default function HeroBox({ explodeProgress, visible }: HeroBoxProps) {
  const groupRef = useRef<THREE.Group>(null)
  const boxRef = useRef<THREE.Mesh>(null)
  const glowRef = useRef<THREE.Mesh>(null)
  const bounce = useRef({ x: 0.9, y: 0.4, vx: 0.021, vy: 0.015 })

  const fragments = useMemo(
    () =>
      Array.from({ length: 30 }, (_, i) => {
        const angle = (i / 30) * Math.PI * 2
        const radius = 0.6 + Math.random() * 0.6
        return {
          startPos: new THREE.Vector3(
            Math.cos(angle) * radius * 0.3,
            (Math.random() - 0.5) * 1.2,
            Math.sin(angle) * radius * 0.3,
          ),
          endPos: new THREE.Vector3(
            Math.cos(angle) * (2 + Math.random() * 4),
            -2 + Math.random() * 4,
            Math.sin(angle) * (2 + Math.random() * 4),
          ),
          startRot: new THREE.Euler(
            Math.random() * Math.PI,
            Math.random() * Math.PI,
            Math.random() * Math.PI,
          ),
        }
      }),
    [],
  )

  useFrame((state) => {
    if (!visible) return
    const t = state.clock.elapsedTime

    // The box flies free during intro (explode ≈ 0), then eases to centre as
    // the morph begins. `freedom` = 1 while intro, 0 once morph starts.
    const freedom = Math.max(0, 1 - explodeProgress / 0.15)
    const b = bounce.current
    const BX = 2.4
    const BY = 1.45
    b.x += b.vx
    b.y += b.vy
    if (b.x > BX || b.x < -BX) b.vx *= -1
    if (b.y > BY || b.y < -BY) b.vy *= -1

    if (groupRef.current) {
      groupRef.current.position.x = b.x * freedom
      groupRef.current.position.y = b.y * freedom
      const introScale = 0.32 + 0.68 * (1 - freedom)
      groupRef.current.scale.setScalar(introScale * (1 - explodeProgress * 0.4))
    }

    if (boxRef.current) {
      boxRef.current.rotation.y = t * 0.25
      boxRef.current.rotation.x = Math.sin(t * 0.4) * 0.08
      boxRef.current.scale.setScalar(1 - explodeProgress * 0.8)
      const mat = boxRef.current.material as THREE.MeshStandardMaterial
      mat.opacity = Math.max(0, 1 - explodeProgress * 2)
    }

    if (glowRef.current) {
      glowRef.current.scale.setScalar(
        (1 - explodeProgress) * (1 + Math.sin(t * 2) * 0.05),
      )
      glowRef.current.rotation.y = t * 0.3
    }
  })

  if (!visible) return null

  return (
    <group ref={groupRef}>
      <mesh ref={glowRef}>
        <boxGeometry args={[1.6, 1.6, 1.6]} />
        <meshBasicMaterial
          color="#0044ff"
          transparent
          opacity={0.03}
          side={THREE.BackSide}
        />
      </mesh>
      <mesh ref={boxRef}>
        <boxGeometry args={[1.5, 1.5, 1.5]} />
        <meshStandardMaterial
          color="#0a1a2a"
          metalness={0.95}
          roughness={0.05}
          transparent
          opacity={1}
          emissive="#001133"
          emissiveIntensity={0.5}
        />
      </mesh>
      <lineSegments>
        <edgesGeometry args={[new THREE.BoxGeometry(1.5, 1.5, 1.5)]} />
        <lineBasicMaterial
          color="#3af"
          transparent
          opacity={Math.max(0, 1 - explodeProgress * 3)}
        />
      </lineSegments>

      {explodeProgress > 0 &&
        fragments.map((f, i) => (
          <Fragment key={i} {...f} progress={explodeProgress} />
        ))}
    </group>
  )
}
