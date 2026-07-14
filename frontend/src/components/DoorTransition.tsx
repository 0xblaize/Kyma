'use client'

import { motion } from 'framer-motion'
import { dataBeats, bell } from '@/lib/journey'

interface DoorTransitionProps {
  phase: number
  phaseProgress: number
}

/**
 * Cinematic blackout as the mannequin crosses each doorway during the journey
 * (turn → DOOR → stairs → DOOR → desk). Pure 2D — sits above the 3D and wipes
 * the screen to black at the threshold of each door, then clears. Fully
 * reversible: scroll back up and the doors "re-open" in reverse.
 */
export default function DoorTransition({ phase, phaseProgress }: DoorTransitionProps) {
  const b = dataBeats(phase, phaseProgress)
  // Darkest at the midpoint of each door crossing.
  const dark = Math.max(bell(b.door1), bell(b.door2)) * 0.92

  return (
    <motion.div
      aria-hidden
      className="pointer-events-none absolute inset-0 z-[18] bg-black"
      style={{ opacity: dark }}
    />
  )
}
