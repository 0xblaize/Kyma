'use client'

import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { useGLTF, useAnimations } from '@react-three/drei'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { AgentState, CLIP_INDEX, ONCE_STATES, FADE } from '@/lib/clips'

useGLTF.preload('/agent_os.glb')

interface AgentModelProps {
  /** Current state machine state — changing it crossfades to the new clip. */
  state: AgentState
  /** Target standing height in world units (default 1.8 ≈ human). */
  targetHeight?: number
}

interface Fit {
  scale: number
  pos: [number, number, number]
}

/**
 * Loads agent_os.glb, exposes its Mixamo clips through useAnimations, and runs
 * a small crossfade state machine. The visual representation of Agent OS.
 *
 * The GLB ships with an Armature scale of 0.01, so the whole rig is ≈0.02 units
 * tall. We auto-fit it to `targetHeight` and rest its feet on y=0.
 *
 * IMPORTANT: we measure the SKELETON (bone world positions) but we apply the
 * fit transform to a WRAPPER GROUP — never to the loaded scene's own
 * scale/position. Mutating the SkinnedMesh's transform after load corrupts its
 * bind matrices and collapses the mesh into a tiny dark blob (which is exactly
 * what was happening: the character was there but rendered as a dark square).
 */
export default function AgentModel({ state, targetHeight = 1.8 }: AgentModelProps) {
  const group = useRef<THREE.Group>(null)
  const { scene, animations } = useGLTF('/agent_os.glb')
  const { actions, names, mixer } = useAnimations(animations, group)
  const current = useRef<AgentState | null>(null)

  const [fit, setFit] = useState<Fit>({ scale: 1, pos: [0, 0, 0] })

  // Material + one-time fit measurement.
  useEffect(() => {
    // Keep the GLB's own materials (colors/textures from the metadata) — do
    // NOT replace them. We only flip shadow flags + frustumCulled so the
    // AI-generated mesh's loose culling box doesn't pop it out of frame.
    // DoubleSide guards against the model's inconsistent face winding.
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

    // Reset any transform a previous (mutating) version of this code may have
    // baked into the cached scene — useGLTF reuses one scene instance, so a
    // leftover ×91 scale would otherwise compound with the wrapper below.
    scene.scale.setScalar(1)
    scene.position.set(0, 0, 0)
    scene.rotation.set(0, 0, 0)
    scene.updateWorldMatrix(true, true)

    // Measure bones in SCENE-LOCAL coordinates, not world coordinates. The
    // outer agent group sits at STAIR_TOP (≈y=3.36); using bone.getWorldPosition
    // here folds that offset into the box, which then made pos.y ≈ -300 and
    // sent the character far below the floor. Pre-multiplying by
    // scene.matrixWorld.invert() strips the parent transform so the resulting
    // box reflects the model's own bind-pose extents.
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
      // setFromObject is also in world space — strip the parent offset.
      box.min.applyMatrix4(sceneInv)
      box.max.applyMatrix4(sceneInv)
    }

    const size = new THREE.Vector3()
    box.getSize(size)
    const center = new THREE.Vector3()
    box.getCenter(center)

    if (size.y > 1e-6 && Number.isFinite(size.y)) {
      const k = targetHeight / size.y
      // The bone-derived box stops at the ankle joint, but the foot MESH
      // extends below that. Without this clearance the feet sink into the
      // pavement. ~6% of body height tracks the ankle-to-sole gap closely
      // for the Mixamo rig.
      const FOOT_CLEARANCE = 0.11
      setFit({
        scale: k,
        pos: [-center.x * k, -box.min.y * k + FOOT_CLEARANCE, -center.z * k],
      })
    } else {
      // Last-ditch fallback if even bone traversal yields nothing usable.
      // 90 ≈ 1.8 / 0.02, matching the previously fingerprinted Mixamo rig.
      setFit({ scale: 90, pos: [0, 0, 0] })
    }
  }, [scene, targetHeight])

  // Crossfade whenever the requested state changes.
  //
  // useLayoutEffect (not useEffect) + an immediate mixer.update(0) so the
  // FIRST animation frame is applied to the bones BEFORE the browser paints.
  // Plain useEffect ran one frame too late, leaving a single bind-pose
  // (T-pose) frame visible during the reveal.
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
    // Skip past any T-pose lead-in baked into looping Mixamo clips: jump
    // 25% into the clip so the first painted frame is mid-breath, not
    // bind pose. Only matters for looping idles where the seam is hidden.
    if (!once) {
      const dur = next.getClip().duration
      next.time = dur * 0.25
    }
    next.fadeIn(isFirst ? 0 : FADE).play()

    if (prev && prev !== next) prev.fadeOut(FADE)

    // Snap the bones to the first frame of the new clip so the next render
    // shows the breathing idle instead of the bind pose. Critical on first
    // play — eliminates the T-pose flash during the reveal.
    if (mixer) mixer.update(0)

    // ALSO force every SkinnedMesh to push the new bone transforms into its
    // boneMatrices buffer. The renderer normally calls `skeleton.update()`
    // inside its skinned-mesh pre-render step, but it skips invisible
    // meshes. The agent is invisible during intro, so without this manual
    // call the GPU buffer stays at bind pose (T-pose) — and the first paint
    // after the box bursts shows that stale bind pose for one frame.
    scene.traverse((o) => {
      const sm = o as THREE.SkinnedMesh
      if (sm.isSkinnedMesh) sm.skeleton.update()
    })

    current.current = state
  }, [state, actions, names, mixer])

  // Force skinning every frame, even when the agent group is invisible.
  //
  // three.js calls skeleton.update() inside WebGLRenderer's onBeforeRender for
  // skinned meshes — but ONLY for meshes that pass visibility culling. While
  // `visible={false}` is set on a parent group during intro, the boneMatrices
  // GPU buffer NEVER receives the mixer's pose updates. The first frame after
  // we flip visibility on then renders the stale bind pose (T-pose) for one
  // paint before the next render catches up.
  //
  // This was asymmetric before: scrolling DOWN, state stays 'stand_idle' the
  // whole intro→morph traversal so the useLayoutEffect above never re-fires,
  // and the buffer is untouched. Scrolling UP, walk→stand_idle is a real state
  // change, the effect fires, and the buffer gets populated before paint.
  //
  // Pumping skeleton.update() every frame here closes the gap in both
  // directions: the buffer is always one frame fresh, so the first VISIBLE
  // paint already shows the breathing pose.
  useFrame(() => {
    scene.traverse((o) => {
      const sm = o as THREE.SkinnedMesh
      if (sm.isSkinnedMesh) sm.skeleton.update()
    })
  })

  // Outer group = animation mixer root. Inner group carries the auto-fit
  // transform so the loaded scene's own matrices stay untouched (skinning safe).
  return (
    <group ref={group}>
      <group scale={fit.scale} position={fit.pos}>
        <primitive object={scene} />
      </group>
    </group>
  )
}
