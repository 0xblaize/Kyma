'use client'

import * as THREE from 'three'

/**
 * Floating "pavement" slab. The agent stands idle on top of this during the
 * morph/thinking phase. We deliberately do NOT render a tall shaft / base —
 * the design only shows the top of the podium (a slab floating in the dark,
 * lit from above) so the character reads as standing on a pavement island.
 *
 * Exports keep the historical names (STAIR_TOP / STAIR_BOTTOM / stairPoint)
 * so AgentScene's journey code keeps working without a rename pass.
 */

export const PODIUM_HEIGHT = 4.0   // elevation of the standing surface
export const PAVEMENT_SIZE = 3.0   // square footprint of the visible slab
export const PAVEMENT_THICKNESS = 0.4

/** Top-of-pavement (standing surface) and ground level world positions. */
export const STAIR_TOP = new THREE.Vector3(0, PODIUM_HEIGHT, 0)
export const STAIR_BOTTOM = new THREE.Vector3(0, 0, 0)

/** Point on the descent path at parametric t (0 = top, 1 = bottom). */
export function stairPoint(t: number, out = new THREE.Vector3()) {
  const c = Math.min(1, Math.max(0, t))
  return out.lerpVectors(STAIR_TOP, STAIR_BOTTOM, c)
}

// All-black palette. The slab is a glossy black square, the undercut is even
// darker so the edge reads as a shadow lip against the void.
const SLAB_MAT = { color: '#0d0e12', metalness: 0.55, roughness: 0.4 }
const UNDER_MAT = { color: '#040407', metalness: 0.6, roughness: 0.55 }
const EDGE_MAT = { color: '#1a1d22', metalness: 0.7, roughness: 0.3 }

/**
 * Just the top of the podium — a thick square pavement slab. The slab's top
 * face sits at PODIUM_HEIGHT (so STAIR_TOP rests on it). A thin dark metal
 * edge strip wraps the top corner so the silhouette of the slab stays legible
 * against the black background under the cool key + rim lighting.
 */
export default function Staircase() {
  const slabCenterY = PODIUM_HEIGHT - PAVEMENT_THICKNESS / 2
  const undercutCenterY = PODIUM_HEIGHT - PAVEMENT_THICKNESS - 0.04
  const edgeY = PODIUM_HEIGHT - 0.012
  const edgeThickness = 0.025
  const edgeInset = 0.015
  const half = PAVEMENT_SIZE / 2

  return (
    <group>
      {/* Main pavement slab — the visible top of the podium. */}
      <mesh position={[0, slabCenterY, 0]} castShadow receiveShadow>
        <boxGeometry args={[PAVEMENT_SIZE, PAVEMENT_THICKNESS, PAVEMENT_SIZE]} />
        <meshStandardMaterial {...SLAB_MAT} />
      </mesh>

      {/* Darker undercut so the slab's underside reads as a shadow lip
          instead of blending into the fog. Inset on all sides. */}
      <mesh position={[0, undercutCenterY, 0]}>
        <boxGeometry args={[PAVEMENT_SIZE - 0.3, 0.08, PAVEMENT_SIZE - 0.3]} />
        <meshStandardMaterial {...UNDER_MAT} />
      </mesh>

      {/* Thin metal edge strips around the top — catch the cool key light to
          define the silhouette of the slab without introducing any colour. */}
      <mesh position={[0, edgeY, half - edgeInset]}>
        <boxGeometry args={[PAVEMENT_SIZE, edgeThickness, 0.03]} />
        <meshStandardMaterial {...EDGE_MAT} />
      </mesh>
      <mesh position={[0, edgeY, -(half - edgeInset)]}>
        <boxGeometry args={[PAVEMENT_SIZE, edgeThickness, 0.03]} />
        <meshStandardMaterial {...EDGE_MAT} />
      </mesh>
      <mesh position={[-(half - edgeInset), edgeY, 0]}>
        <boxGeometry args={[0.03, edgeThickness, PAVEMENT_SIZE]} />
        <meshStandardMaterial {...EDGE_MAT} />
      </mesh>
      <mesh position={[half - edgeInset, edgeY, 0]}>
        <boxGeometry args={[0.03, edgeThickness, PAVEMENT_SIZE]} />
        <meshStandardMaterial {...EDGE_MAT} />
      </mesh>
    </group>
  )
}
