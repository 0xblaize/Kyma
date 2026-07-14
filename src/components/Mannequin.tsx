'use client'
import { useRef, useMemo, forwardRef, useImperativeHandle } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'

export interface MannequinHandle {
  group: THREE.Group | null
}

interface Props {
  scale?: number
  animOffset?: number
  pose?: 'stand' | 'sit' | 'leanback'
}

// Shared gold material properties
const GOLD = {
  color: '#b8870a',
  metalness: 1.0,
  roughness: 0.04,
  envMapIntensity: 3.0,
}

const Mannequin = forwardRef<MannequinHandle, Props>(
  ({ scale = 1, animOffset = 0, pose = 'stand' }, ref) => {
    const groupRef = useRef<THREE.Group>(null)
    const lArmRef = useRef<THREE.Group>(null)
    const rArmRef = useRef<THREE.Group>(null)
    const headRef = useRef<THREE.Group>(null)
    const torsoRef = useRef<THREE.Group>(null)

    useImperativeHandle(ref, () => ({ group: groupRef.current }))

    // Build all geometries once
    const geo = useMemo(() => {
      // Head: smooth egg shape — slightly wider at cheeks, tapers at top and chin
      const headGeo = new THREE.SphereGeometry(1, 64, 64)
      // Squish into egg: narrow top, wider middle
      const headPos = headGeo.attributes.position
      for (let i = 0; i < headPos.count; i++) {
        const y = headPos.getY(i)
        const xz = Math.sqrt(headPos.getX(i) ** 2 + headPos.getZ(i) ** 2)
        // Taper at top and bottom, wide in middle
        const bulge = 1 + 0.18 * Math.sin(((y + 1) / 2) * Math.PI)
        headPos.setX(i, headPos.getX(i) * bulge * 0.88)
        headPos.setZ(i, headPos.getZ(i) * bulge * 0.82)
        headPos.setY(i, y * 1.15)
      }
      headGeo.computeVertexNormals()

      // Torso: sculpted with custom geometry
      const torsoGeo = new THREE.CylinderGeometry(0.38, 0.3, 1.6, 32, 4, false)
      const torsoPos = torsoGeo.attributes.position
      for (let i = 0; i < torsoPos.count; i++) {
        const y = torsoPos.getY(i) // -0.8 to 0.8
        const x = torsoPos.getX(i)
        const z = torsoPos.getZ(i)
        // Chest wider at top, waist narrow, slight forward chest
        const chestBulge = y > 0 ? 1 + y * 0.35 : 1 - Math.abs(y) * 0.1
        const frontBulge = z > 0 ? 1 + z * 0.1 * Math.max(0, y) : 1
        torsoPos.setX(i, x * chestBulge)
        torsoPos.setZ(i, z * chestBulge * 0.85 * frontBulge)
        // Waist pinch
        const waist = y > -0.2 && y < 0.2 ? 0.88 : 1
        torsoPos.setX(i, torsoPos.getX(i) * waist)
        torsoPos.setZ(i, torsoPos.getZ(i) * waist)
      }
      torsoGeo.computeVertexNormals()

      return {
        head: headGeo,
        torso: torsoGeo,
        neck: new THREE.CylinderGeometry(0.115, 0.14, 0.28, 32),
        shoulder: new THREE.SphereGeometry(0.18, 32, 32),
        upperArm: new THREE.CapsuleGeometry(0.115, 0.52, 12, 24),
        lowerArm: new THREE.CapsuleGeometry(0.095, 0.44, 12, 24),
        hand: new THREE.SphereGeometry(0.11, 24, 24),
        pelvis: new THREE.CylinderGeometry(0.32, 0.28, 0.38, 32),
        upperLeg: new THREE.CapsuleGeometry(0.168, 0.62, 12, 24),
        knee: new THREE.SphereGeometry(0.145, 24, 24),
        lowerLeg: new THREE.CapsuleGeometry(0.128, 0.52, 12, 24),
        foot: (() => {
          const g = new THREE.BoxGeometry(0.18, 0.1, 0.32)
          // Round the foot slightly
          return g
        })(),
        // Pec detail
        pec: new THREE.SphereGeometry(0.24, 32, 24),
        // Trapezius
        trap: new THREE.SphereGeometry(0.2, 24, 24),
        // Deltoid
        delt: new THREE.SphereGeometry(0.155, 24, 24),
        // Glute
        glute: new THREE.SphereGeometry(0.2, 24, 24),
        // Calf
        calf: new THREE.SphereGeometry(0.11, 20, 20),
      }
    }, [])

    useFrame((state) => {
      if (!groupRef.current) return
      const t = state.clock.elapsedTime + animOffset

      if (pose === 'stand') {
        groupRef.current.position.y = Math.sin(t * 0.7) * 0.018
        groupRef.current.rotation.y = Math.sin(t * 0.28) * 0.055
      }

      if (headRef.current) {
        headRef.current.rotation.y = Math.sin(t * 0.32) * 0.07
        headRef.current.rotation.x = Math.sin(t * 0.22) * 0.03 + (pose === 'leanback' ? -0.05 : 0)
      }

      if (lArmRef.current) {
        if (pose === 'stand') {
          lArmRef.current.rotation.x = Math.sin(t * 0.7 + 0.3) * 0.04
          lArmRef.current.rotation.z = 0.08 + Math.sin(t * 0.5) * 0.025
        } else if (pose === 'sit') {
          lArmRef.current.rotation.x = 0.55
          lArmRef.current.rotation.z = 0.18
        } else if (pose === 'leanback') {
          lArmRef.current.rotation.x = -0.25
          lArmRef.current.rotation.z = 0.12
        }
      }
      if (rArmRef.current) {
        if (pose === 'stand') {
          rArmRef.current.rotation.x = Math.sin(t * 0.7) * 0.04
          rArmRef.current.rotation.z = -0.08 + Math.sin(t * 0.5 + Math.PI) * 0.025
        } else if (pose === 'sit') {
          rArmRef.current.rotation.x = 0.55
          rArmRef.current.rotation.z = -0.18
        } else if (pose === 'leanback') {
          rArmRef.current.rotation.x = -0.25
          rArmRef.current.rotation.z = -0.12
        }
      }
    })

    const M = ({ g, p, r, s }: {
      g: THREE.BufferGeometry
      p?: [number, number, number]
      r?: [number, number, number]
      s?: [number, number, number] | number
    }) => (
      <mesh geometry={g} position={p} rotation={r} scale={s} castShadow receiveShadow>
        <meshStandardMaterial {...GOLD} />
      </mesh>
    )

    const isSit = pose === 'sit'
    const isLean = pose === 'leanback'

    // Y offset for seated pose
    const bY = isSit ? -0.55 : 0

    return (
      <group ref={groupRef} scale={scale}>

        {/* ── HEAD ── */}
        <group ref={headRef} position={[0, 2.42 + bY, 0]}>
          <M g={geo.head} s={[0.38, 0.44, 0.36]} />
          {/* Very subtle face plane — slight forward flatten */}
          <M g={geo.head} s={[0.36, 0.41, 0.28]} p={[0, 0, 0.04]} />
        </group>

        {/* ── NECK ── */}
        <M g={geo.neck} p={[0, 2.1 + bY, 0]} />

        {/* ── TORSO ── */}
        <group ref={torsoRef} position={[0, bY, 0]}
          rotation={isLean ? [-0.28, 0, 0] : [0, 0, 0]}>
          <M g={geo.torso} p={[0, 1.42, 0]} />

          {/* Pecs */}
          <M g={geo.pec} p={[-0.26, 1.62, 0.12]} s={[0.85, 0.62, 0.46]} />
          <M g={geo.pec} p={[0.26, 1.62, 0.12]} s={[0.85, 0.62, 0.46]} />

          {/* Traps */}
          <M g={geo.trap} p={[-0.28, 1.9, -0.06]} s={[0.65, 0.52, 0.5]} />
          <M g={geo.trap} p={[0.28, 1.9, -0.06]} s={[0.65, 0.52, 0.5]} />

          {/* Deltoids */}
          <M g={geo.delt} p={[-0.5, 1.82, 0]} s={[0.88, 0.75, 0.78]} />
          <M g={geo.delt} p={[0.5, 1.82, 0]} s={[0.88, 0.75, 0.78]} />

          {/* Ab detail — 3 rows */}
          {([-0.14, 0.14] as number[]).flatMap((x) =>
            ([1.22, 1.06, 0.9] as number[]).map((y, j) => (
              <M key={`ab${x}${y}`} g={geo.knee} p={[x, y, 0.28]} s={[0.42, 0.28, 0.24]} />
            ))
          )}

          {/* Obliques */}
          <M g={geo.calf} p={[-0.34, 1.1, 0.1]} s={[0.9, 1.1, 0.7]} />
          <M g={geo.calf} p={[0.34, 1.1, 0.1]} s={[0.9, 1.1, 0.7]} />

          {/* Pelvis */}
          <M g={geo.pelvis} p={[0, 0.58, 0]} s={[1.05, 1, 0.88]} />

          {/* Glutes */}
          <M g={geo.glute} p={[-0.18, 0.52, -0.22]} s={[0.88, 0.85, 0.7]} />
          <M g={geo.glute} p={[0.18, 0.52, -0.22]} s={[0.88, 0.85, 0.7]} />

          {/* ── LEFT ARM ── */}
          <group ref={lArmRef} position={[-0.54, 1.82, 0]}>
            <M g={geo.shoulder} p={[-0.06, 0, 0]} s={[1.05, 0.95, 0.95]} />
            <M g={geo.upperArm} p={[-0.06, -0.46, 0]} r={[0, 0, 0.1]} />
            {/* Elbow */}
            <M g={geo.knee} p={[-0.1, -0.94, 0]} s={0.88} />
            <M g={geo.lowerArm} p={[-0.1, -1.42, 0.04]} r={[0.06, 0, 0.06]} />
            <M g={geo.hand} p={[-0.12, -1.88, 0.04]} s={[1, 0.82, 0.72]} />
          </group>

          {/* ── RIGHT ARM ── */}
          <group ref={rArmRef} position={[0.54, 1.82, 0]}>
            <M g={geo.shoulder} p={[0.06, 0, 0]} s={[1.05, 0.95, 0.95]} />
            <M g={geo.upperArm} p={[0.06, -0.46, 0]} r={[0, 0, -0.1]} />
            <M g={geo.knee} p={[0.1, -0.94, 0]} s={0.88} />
            <M g={geo.lowerArm} p={[0.1, -1.42, 0.04]} r={[0.06, 0, -0.06]} />
            <M g={geo.hand} p={[0.12, -1.88, 0.04]} s={[1, 0.82, 0.72]} />
          </group>
        </group>

        {/* ── LEGS ── */}
        {!isSit ? (
          <>
            {/* LEFT LEG */}
            <M g={geo.upperLeg} p={[-0.22, -0.35, 0]} s={[1, 1, 0.9]} />
            <M g={geo.knee} p={[-0.22, -1.06, 0.04]} />
            <M g={geo.lowerLeg} p={[-0.22, -1.7, 0.04]} s={[1, 1, 0.88]} />
            <M g={geo.calf} p={[-0.22, -1.75, -0.1]} s={[0.85, 1.1, 0.75]} />
            <M g={geo.foot} p={[-0.22, -2.22, 0.1]} />

            {/* RIGHT LEG */}
            <M g={geo.upperLeg} p={[0.22, -0.35, 0]} s={[1, 1, 0.9]} />
            <M g={geo.knee} p={[0.22, -1.06, 0.04]} />
            <M g={geo.lowerLeg} p={[0.22, -1.7, 0.04]} s={[1, 1, 0.88]} />
            <M g={geo.calf} p={[0.22, -1.75, -0.1]} s={[0.85, 1.1, 0.75]} />
            <M g={geo.foot} p={[0.22, -2.22, 0.1]} />
          </>
        ) : (
          <>
            {/* SEATED LEGS */}
            <M g={geo.upperLeg} p={[-0.22, -0.55, 0.35]}
              r={[Math.PI * 0.44, 0, 0.05]} s={[1, 1, 0.9]} />
            <M g={geo.knee} p={[-0.22, -0.62, 0.82]} />
            <M g={geo.lowerLeg} p={[-0.22, -1.0, 1.08]}
              r={[-Math.PI * 0.42, 0, 0.03]} s={[1, 1, 0.88]} />

            <M g={geo.upperLeg} p={[0.22, -0.55, 0.35]}
              r={[Math.PI * 0.44, 0, -0.05]} s={[1, 1, 0.9]} />
            <M g={geo.knee} p={[0.22, -0.62, 0.82]} />
            <M g={geo.lowerLeg} p={[0.22, -1.0, 1.08]}
              r={[-Math.PI * 0.42, 0, -0.03]} s={[1, 1, 0.88]} />
          </>
        )}
      </group>
    )
  }
)

Mannequin.displayName = 'Mannequin'
export default Mannequin
