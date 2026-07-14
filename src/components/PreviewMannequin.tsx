'use client'

import { motion } from 'framer-motion'
import { PHASE } from '@/lib/phases'
import { dataBeats } from '@/lib/journey'

interface PreviewMannequinProps {
  phase: number
  phaseProgress: number
}

// ────────────────────────────────────────────────────────────────────────────
//  TEMPORARY PREVIEW STAND-IN — delete when your real 3D mannequin is mounted.
//  Flat SVG silhouette so you can feel the 6-beat flow. ONE figure the whole
//  way through — it just transforms per phase, never gets re-created.
// ────────────────────────────────────────────────────────────────────────────

export default function PreviewMannequin({ phase, phaseProgress }: PreviewMannequinProps) {
  // The figure doesn't exist visually until the box has morphed (phase 1).
  const born = phase >= PHASE.morph

  // Phase 1: fade/scale in as the box hands over.
  const appear = phase === PHASE.morph ? phaseProgress : born ? 1 : 0

  // Phase 2 journey: turn around → door → down the stairs → door → desk.
  const b = dataBeats(phase, phaseProgress)
  const flip = 1 - 2 * b.turn // 1 → -1 (turns to back view)
  // Descending the staircase: sink down + shrink (walking away/down).
  const descend = b.stairs * 70
  const shrinkStairs = b.stairs * 0.18

  // Phase 3: sits down at the desk — drop + shrink a touch, dim into shadow.
  const sitting = phase === PHASE.shadows ? phaseProgress : phase > PHASE.shadows ? 1 : 0
  const drop = descend + sitting * 90 // stairs descent + into the chair
  const dim = phase >= PHASE.shadows ? 0.45 : 1 // obscured / dark

  // Phase 4: fusion — everything glows and locks together.
  const fusion = phase === PHASE.fusion ? phaseProgress : phase > PHASE.fusion ? 1 : 0

  return (
    <motion.div
      className="pointer-events-none absolute inset-0 z-[15] flex items-center justify-center"
      animate={{ opacity: appear }}
      transition={{ duration: 0.4 }}
    >
      <motion.svg
        width="180"
        viewBox="0 0 120 220"
        animate={{
          scaleX: flip || 1, // turn-around
          y: drop, // down the stairs + into the chair
          scale: 1 - shrinkStairs - sitting * 0.12,
          opacity: born ? dim + fusion * 0.55 : 0,
          filter: `drop-shadow(0 0 ${10 + fusion * 50}px rgba(163,230,53,${0.2 + fusion * 0.6}))`,
        }}
        transition={{ type: 'spring', stiffness: 90, damping: 18 }}
      >
        {/* head */}
        <circle cx="60" cy="28" r="20" fill="#a3e635" />
        {/* torso */}
        <rect x="38" y="52" width="44" height="74" rx="16" fill="#a3e635" />
        {/* arms */}
        <rect x="20" y="56" width="14" height="60" rx="7" fill="#a3e635" opacity="0.85" />
        <rect x="86" y="56" width="14" height="60" rx="7" fill="#a3e635" opacity="0.85" />
        {/* legs */}
        <rect x="42" y="128" width="14" height="70" rx="7" fill="#a3e635" opacity="0.9" />
        <rect x="64" y="128" width="14" height="70" rx="7" fill="#a3e635" opacity="0.9" />
      </motion.svg>

      {/* fusion ring — a hint of the "everything merges into one" beat */}
      <motion.div
        className="absolute rounded-full border border-acid"
        style={{ width: 320, height: 320 }}
        animate={{ opacity: fusion * 0.5, scale: 0.8 + fusion * 0.4, rotate: fusion * 90 }}
        transition={{ type: 'spring', stiffness: 60, damping: 20 }}
      />
    </motion.div>
  )
}
