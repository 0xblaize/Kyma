'use client'

import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { useGLTF, useAnimations } from '@react-three/drei'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { AgentState, CLIP_INDEX, ONCE_STATES, FADE } from '@/lib/clips'

useGLTF.preload('/agent_os.glb')

interface DashboardAgentModelProps {
  /** Current state machine state — changing it crossfades to the new clip. */
  state: AgentState
  /** Target standing height in world units (default 1.55 — smaller than the
   *  landing rig because the dashboard viewport is tighter). */
  targetHeight?: number
}

interface Fit {
  scale: number
  pos: [number, number, number]
}

// ─────────────────────────────────────────────────────────────────────────
// DashboardAgentModel — fork of AgentModel dedicated to the dashboard.
//
// Why a fork: the landing rig has its own cinematic timing (T-pose flash
// avoidance, crossfade duration, hip nudge for the chair scene). Tuning
// any of that for the landing was silently re-shaping the dashboard
// because both panels imported the same component and shared the cached
// GLB instance via useGLTF.
//
// This copy keeps the dashboard's behavior frozen even if AgentModel.tsx
// evolves. Both files still load /agent_os.glb (drei caches it), but
// scene-level material flips and skeleton pumps are no longer shared.
// ─────────────────────────────────────────────────────────────────────────

export default function DashboardAgentModel({
  state,
  targetHeight = 1.55,
}: DashboardAgentModelProps) {
  const group = useRef<THREE.Group>(null)
  const { scene, animations } = useGLTF('/agent_os.glb')
  const { actions, names, mixer } = useAnimations(animations, group)
  const current = useRef<AgentState | null>(null)

  const [fit, setFit] = useState<Fit>({ scale: 1, pos: [0, 0, 0] })

  // Material + one-time fit measurement.
  useEffect(() => {
    scene.traverse((o) => {
      if ((o as THREE.Mesh).isMesh) {
        const m = o as THREE.Mesh
        m.castShadow = true
        m.receiveShadow = true
        m.frustumCulled = false
        const mat = m.material as THREE.Material | THREE.Material[] | undefined
        if (Array.isArray(mat)) mat.forEach((x) => (x.side = THREE.DoubleSide))
        else if (mat) mat.side = THREE.DoubleSide
      }
    })

    scene.scale.setScalar(1)
    scene.position.set(0, 0, 0)
    scene.rotation.set(0, 0, 0)
    scene.updateWorldMatrix(true, true)

    const sceneInv = new THREE.Matrix4().copy(scene.matrixWorld).invert()
    const box = new THREE.Box3()
    const p = new THREE.Vector3()
    let bones = 0
    scene.traverse((o) => {
      if ((o as THREE.Bone).isBone) {
        o.getWorldPosition(p)
        p.applyMatrix4(sceneInv)
        box.expandByPoint(p)
        bones++
      }
    })
    if (bones === 0) {
      box.setFromObject(scene)
      box.min.applyMatrix4(sceneInv)
      box.max.applyMatrix4(sceneInv)
    }

    const size = new THREE.Vector3()
    box.getSize(size)
    const center = new THREE.Vector3()
    box.getCenter(center)

    if (size.y > 1e-6 && Number.isFinite(size.y)) {
      const k = targetHeight / size.y
      const FOOT_CLEARANCE = 0.11
      setFit({
        scale: k,
        pos: [-center.x * k, -box.min.y * k + FOOT_CLEARANCE, -center.z * k],
      })
    } else {
      setFit({ scale: 90, pos: [0, 0, 0] })
    }
  }, [scene, targetHeight])

  // Crossfade whenever the requested state changes.
  useLayoutEffect(() => {
    if (current.current === state) return

    const nextName = names[CLIP_INDEX[state]]
    const next = nextName ? actions[nextName] : undefined
    if (!next) return

    const prevName = current.current != null ? names[CLIP_INDEX[current.current]] : undefined
    const prev = prevName ? actions[prevName] : undefined

    const isFirst = current.current == null
    const once = ONCE_STATES.has(state)
    next
      .reset()
      .setLoop(once ? THREE.LoopOnce : THREE.LoopRepeat, once ? 1 : Infinity)
    next.clampWhenFinished = once
    next.enabled = true
    next.setEffectiveWeight(1)
    if (!once) {
      const dur = next.getClip().duration
      next.time = dur * 0.25
    }
    next.fadeIn(isFirst ? 0 : FADE).play()

    if (prev && prev !== next) prev.fadeOut(FADE)

    if (mixer) mixer.update(0)
    scene.traverse((o) => {
      const sm = o as THREE.SkinnedMesh
      if (sm.isSkinnedMesh) sm.skeleton.update()
    })

    current.current = state
  }, [state, actions, names, mixer, scene])

  // Pump skinning every frame so the dashboard mannequin never shows a
  // bind-pose flash when the panel re-mounts (e.g. after a lifecycle reset).
  useFrame(() => {
    scene.traverse((o) => {
      const sm = o as THREE.SkinnedMesh
      if (sm.isSkinnedMesh) sm.skeleton.update()
    })
  })

  return (
    <group ref={group}>
      <group scale={fit.scale} position={fit.pos}>
        <primitive object={scene} />
      </group>
    </group>
  )
}
