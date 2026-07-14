'use client'

import { useEffect, useRef, useState } from 'react'
import { useScroll, useMotionValueEvent } from 'framer-motion'
import { PHASE_COUNT } from '@/lib/phases'

const VISITED_KEY = 'agentos:visited'
const SCROLLY_KEY = 'agentos:scrollY'

export interface ScrollPhase {
  /** Ref to attach to the tall scroll container. */
  containerRef: React.RefObject<HTMLDivElement | null>
  /** Current phase index 0..PHASE_COUNT-1. */
  phase: number
  /** Progress within the current phase, 0→1. */
  phaseProgress: number
  /** True the instant the user begins scrolling (drives the box "snap"). */
  hasScrolled: boolean
}

/**
 * Tracks document scroll across the tall container and derives the active phase.
 * One viewport of scroll ≈ one phase.
 */
export function useScrollPhase(): ScrollPhase {
  const containerRef = useRef<HTMLDivElement>(null)
  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ['start start', 'end end'],
  })

  const [phase, setPhase] = useState(0)
  const [phaseProgress, setPhaseProgress] = useState(0)
  const [hasScrolled, setHasScrolled] = useState(false)

  useMotionValueEvent(scrollYProgress, 'change', (v) => {
    const raw = v * PHASE_COUNT // 0 → PHASE_COUNT
    const p = Math.min(PHASE_COUNT - 1, Math.max(0, Math.floor(raw)))
    setPhase(p)
    setPhaseProgress(raw - p)
    if (v > 0.001) setHasScrolled(true)
  })

  return { containerRef, phase, phaseProgress, hasScrolled }
}

export interface Persistence {
  /** True once we've read localStorage (avoids an intro flash before hydration). */
  ready: boolean
  /** Returning visitor — skip the zigzag intro and start centered. */
  skipIntro: boolean
}

/**
 * Remembers that a user has visited and where they were. On return we skip the
 * intro animation and restore their scroll position — no re-watching the show.
 */
export function usePersistence(): Persistence {
  const [ready, setReady] = useState(false)
  const [skipIntro, setSkipIntro] = useState(false)

  useEffect(() => {
    let visited = false
    try {
      visited = localStorage.getItem(VISITED_KEY) === '1'
    } catch {
      /* storage unavailable (private mode) — treat as first visit */
    }

    if (visited) {
      setSkipIntro(true)
      // Restore prior scroll position so they "hold" where they left off.
      try {
        const y = parseInt(localStorage.getItem(SCROLLY_KEY) || '0', 10)
        if (y > 0) window.scrollTo(0, y)
      } catch {
        /* ignore */
      }
    }

    try {
      localStorage.setItem(VISITED_KEY, '1')
    } catch {
      /* ignore */
    }
    setReady(true)

    // Persist scroll position (throttled) so a reload keeps their place.
    let timer: number | undefined
    const onScroll = () => {
      if (timer) window.clearTimeout(timer)
      timer = window.setTimeout(() => {
        try {
          localStorage.setItem(SCROLLY_KEY, String(window.scrollY))
        } catch {
          /* ignore */
        }
      }, 150)
    }
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => {
      window.removeEventListener('scroll', onScroll)
      if (timer) window.clearTimeout(timer)
    }
  }, [])

  return { ready, skipIntro }
}
