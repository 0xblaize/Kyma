'use client'

import * as THREE from 'three'

/** World position the agent sits at (chair seat). Placed FAR out across the
 *  floor from the bottom of the stairs (z=0), so after descending the agent
 *  has to walk a real distance to reach the desk. */
export const SEAT_POS = new THREE.Vector3(0, 0, -6.5)

const DARK = { color: '#0a0c10', metalness: 0.8, roughness: 0.3 }
const ACCENT = { color: '#a3e635', emissive: '#a3e635', emissiveIntensity: 1.2, toneMapped: false }

/**
 * Gaming chair + desk + triple-monitor rig, built from primitives. The agent
 * sits here after descending the stairs. Monitors emit the "live data" glow.
 */
export default function DeskRig({ screenGlow = 0 }: { screenGlow?: number }) {
  return (
    <group position={[SEAT_POS.x, 0, SEAT_POS.z]}>
      {/* ── GAMING CHAIR ── */}
      <group>
        {/* seat */}
        <mesh position={[0, 0.5, 0]} castShadow receiveShadow>
          <boxGeometry args={[0.62, 0.16, 0.6]} />
          <meshStandardMaterial {...DARK} />
        </mesh>
        {/* backrest */}
        <mesh position={[0, 1.12, -0.32]} rotation={[-0.12, 0, 0]} castShadow>
          <boxGeometry args={[0.62, 1.05, 0.14]} />
          <meshStandardMaterial {...DARK} />
        </mesh>
        {/* racing-stripe accent on backrest */}
        <mesh position={[0, 1.12, -0.25]} rotation={[-0.12, 0, 0]}>
          <boxGeometry args={[0.12, 0.95, 0.02]} />
          <meshStandardMaterial {...ACCENT} />
        </mesh>
        {/* headrest */}
        <mesh position={[0, 1.74, -0.28]} rotation={[-0.12, 0, 0]} castShadow>
          <boxGeometry args={[0.46, 0.26, 0.14]} />
          <meshStandardMaterial {...DARK} />
        </mesh>
        {/* armrests */}
        {[-0.4, 0.4].map((x) => (
          <mesh key={x} position={[x, 0.78, 0]} castShadow>
            <boxGeometry args={[0.1, 0.1, 0.42]} />
            <meshStandardMaterial {...DARK} />
          </mesh>
        ))}
        {/* center pole */}
        <mesh position={[0, 0.28, 0]} castShadow>
          <cylinderGeometry args={[0.06, 0.06, 0.44, 12]} />
          <meshStandardMaterial color="#1a1d24" metalness={0.9} roughness={0.2} />
        </mesh>
        {/* 5-star base */}
        {Array.from({ length: 5 }, (_, i) => {
          const a = (i / 5) * Math.PI * 2
          return (
            <mesh key={i} position={[Math.cos(a) * 0.26, 0.06, Math.sin(a) * 0.26]} rotation={[0, -a, 0]} castShadow>
              <boxGeometry args={[0.34, 0.06, 0.08]} />
              <meshStandardMaterial color="#1a1d24" metalness={0.9} roughness={0.25} />
            </mesh>
          )
        })}
      </group>

      {/* ── DESK ── */}
      <group position={[0, 0, 0.95]}>
        <mesh position={[0, 1.0, 0]} castShadow receiveShadow>
          <boxGeometry args={[2.4, 0.08, 0.8]} />
          <meshStandardMaterial color="#0d0f14" metalness={0.6} roughness={0.4} />
        </mesh>
        {[-1.05, 1.05].map((x) => (
          <mesh key={x} position={[x, 0.5, 0]} castShadow>
            <boxGeometry args={[0.08, 1.0, 0.7]} />
            <meshStandardMaterial {...DARK} />
          </mesh>
        ))}

        {/* ── TRIPLE MONITORS ── */}
        {/* Agent sits at SEAT_POS (chair center, group origin), desk group is
            at +z 0.95. Monitors sit on the chair-facing edge of the desktop,
            so their screens must face world -Z (back toward the chair).
            Math.PI on the Y rotation flips the planeGeometry's outward
            normal (+Z by default) to point -Z. The +x*0.35 toe-in then
            angles the side monitors inward toward the agent. Mirrors the
            working DashboardAgentScene layout. */}
        {[-0.82, 0, 0.82].map((x, i) => (
          <group key={i} position={[x, 1.5, -0.18]} rotation={[0, Math.PI + x * 0.35, 0]}>
            {/* bezel */}
            <mesh castShadow>
              <boxGeometry args={[0.78, 0.46, 0.04]} />
              <meshStandardMaterial color="#05060a" metalness={0.5} roughness={0.5} />
            </mesh>
            {/* glowing screen — brightens with screenGlow (typing/live data) */}
            <mesh position={[0, 0, 0.025]}>
              <planeGeometry args={[0.72, 0.4]} />
              <meshStandardMaterial
                color="#0a2a1a"
                emissive="#a3e635"
                emissiveIntensity={0.25 + screenGlow * 1.6}
                toneMapped={false}
              />
            </mesh>
            {/* stand */}
            <mesh position={[0, -0.34, 0]}>
              <boxGeometry args={[0.08, 0.24, 0.06]} />
              <meshStandardMaterial {...DARK} />
            </mesh>
          </group>
        ))}
        {/* Screen fill light — sits on the chair side of the monitors so the
            acid-green spill lands on the seat / agent face, not into the void
            behind the desk. */}
        <pointLight position={[0, 1.5, -0.45]} color="#a3e635" intensity={screenGlow * 3} distance={4} />
      </group>
    </group>
  )
}
