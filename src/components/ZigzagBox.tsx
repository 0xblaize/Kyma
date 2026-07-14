'use client'

import { useEffect, useRef } from 'react'
import { motion, useMotionValue, animate } from 'framer-motion'

const BOX = 60 // px, the little box/dot

interface ZigzagBoxProps {
  /** While true the box flies around the screen, DVD-logo style. */
  active: boolean
  /** While true the box springs to dead-center and morphs out. */
  snap: boolean
}

/**
 * Phase 0 visual: a small, very clear box that zig-zags around the viewport
 * like an old TV-network screensaver. The instant the user scrolls (`snap`),
 * it stops, springs to the exact center, then scales up and fades — handing
 * the center off to the 3D mannequin.
 */
export default function ZigzagBox({ active, snap }: ZigzagBoxProps) {
  const x = useMotionValue(0) // offset from center
  const y = useMotionValue(0)
  const vel = useRef({ x: 3.4, y: 2.6 }) // px/frame
  const raf = useRef<number | undefined>(undefined)

  // ── DVD bounce loop ──
  useEffect(() => {
    if (!active) return
    const tick = () => {
      const maxX = (window.innerWidth - BOX) / 2
      const maxY = (window.innerHeight - BOX) / 2
      let nx = x.get() + vel.current.x
      let ny = y.get() + vel.current.y
      if (nx > maxX || nx < -maxX) {
        vel.current.x *= -1
        nx = Math.max(-maxX, Math.min(maxX, nx))
      }
      if (ny > maxY || ny < -maxY) {
        vel.current.y *= -1
        ny = Math.max(-maxY, Math.min(maxY, ny))
      }
      x.set(nx)
      y.set(ny)
      raf.current = requestAnimationFrame(tick)
    }
    raf.current = requestAnimationFrame(tick)
    return () => {
      if (raf.current) cancelAnimationFrame(raf.current)
    }
  }, [active, x, y])

  // ── Snap to center on first scroll ──
  useEffect(() => {
    if (!snap) return
    const cx = animate(x, 0, { type: 'spring', stiffness: 140, damping: 18 })
    const cy = animate(y, 0, { type: 'spring', stiffness: 140, damping: 18 })
    return () => {
      cx.stop()
      cy.stop()
    }
  }, [snap, x, y])

  return (
    <motion.div
      aria-hidden
      className="pointer-events-none fixed left-1/2 top-1/2 z-30"
      style={{ x, y, marginLeft: -BOX / 2, marginTop: -BOX / 2 }}
      // Once centered: bloom slightly then fade out so the mannequin can appear.
      animate={
        snap
          ? { scale: [1, 1.35, 1.1], opacity: [1, 1, 0] }
          : { scale: 1, opacity: 1 }
      }
      transition={
        snap
          ? { duration: 1.1, times: [0, 0.5, 1], ease: 'easeInOut', delay: 0.25 }
          : { duration: 0.3 }
      }
    >
      <div
        className="h-[60px] w-[60px] rounded-[6px] bg-acid shadow-acid"
        style={{ width: BOX, height: BOX }}
      />
    </motion.div>
  )
}
