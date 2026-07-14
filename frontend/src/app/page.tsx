'use client'

import { motion, AnimatePresence } from 'framer-motion'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useScrollPhase, usePersistence } from '@/hooks/useKyma'
import { PHASE, PHASE_COUNT } from '@/lib/phases'
import PhaseStage from '@/components/PhaseStage'
import DoorTransition from '@/components/DoorTransition'
import Terminal from '@/components/Terminal'
import GetStartedButton from '@/components/GetStartedButton'

export default function KymaPage() {
  const router = useRouter()
  const { containerRef, phase, phaseProgress } = useScrollPhase()
  usePersistence() // remembers visit + restores scroll position

  // "At the very top" — position driven, so it flips back the moment you
  // scroll back up to phase 0. Everything else already reverses via phase.
  const atIntroTop = phase === PHASE.intro && phaseProgress < 0.05

  // Title fades out as you scroll away from the top, fades back in on return.
  const showTitle = phase === PHASE.intro
  const titleOpacity = Math.max(0, 1 - phaseProgress / 0.4)

  const showCTA = phase === PHASE.cta && phaseProgress > 0.5

  return (
    <main className="bg-surface-0">
      {/* Tall scroll container: one viewport per phase. The inner stage is
          sticky, so all visuals stay pinned while we scroll through phases. */}
      <div
        ref={containerRef}
        className="relative"
        style={{ height: `${PHASE_COUNT * 100}vh` }}
      >
        <div className="sticky top-0 h-screen w-full overflow-hidden">
          {/* ── Phases 0–1: old hero (box→mannequin) + journey 3D ── */}
          <PhaseStage phase={phase} phaseProgress={phaseProgress} />

          {/* ── Phase 0: the big name ── */}
          <AnimatePresence>
            {showTitle && (
              <motion.div
                className="pointer-events-none absolute inset-0 z-30 flex flex-col items-center justify-center"
                initial={{ opacity: 0 }}
                animate={{ opacity: titleOpacity }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.3 }}
              >
                <div className="mb-3 font-mono text-[11px] uppercase tracking-[0.35em] text-acid/55">
                  autonomous trading intelligence
                </div>
                <h1 className="text-center font-display text-[clamp(72px,13vw,180px)] leading-[0.82] tracking-wide text-white">
                  KYMA
                  <br />
                  <span className="text-acid">.TERMINAL</span>
                </h1>
              </motion.div>
            )}
          </AnimatePresence>

          {/* ── Phase 2: blackout while crossing each doorway ── */}
          <DoorTransition phase={phase} phaseProgress={phaseProgress} />

          {/* ── Phase 4: live data feed while the agent is processing/typing ── */}
          <Terminal active={phase === PHASE.fusion} />

          {/* ── Phase 5: the one and only CTA ── */}
          <GetStartedButton visible={showCTA} onClick={() => router.push('/dashboard')} />

          {/* ── Persistent skip control — bails straight to the app ── */}
          <Link
            href="/dashboard"
            className="pointer-events-auto absolute right-6 top-6 z-50 rounded-full border border-acid/40 bg-surface-0/60 px-4 py-2 font-mono text-[10px] uppercase tracking-[0.3em] text-acid/80 backdrop-blur transition hover:bg-acid hover:text-black"
          >
            Skip intro →
          </Link>

          {/* ── Scroll hint — only at the very start, no other clutter ── */}
          <AnimatePresence>
            {atIntroTop && (
              <motion.div
                className="pointer-events-none absolute inset-x-0 bottom-10 z-30 flex flex-col items-center gap-2.5"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
              >
                <span className="font-mono text-[9px] uppercase tracking-[0.35em] text-white/30">
                  scroll down
                </span>
                <motion.span
                  className="block h-10 w-px bg-gradient-to-b from-acid/60 to-transparent"
                  animate={{ scaleY: [1, 1.25, 1], opacity: [0.3, 1, 0.3] }}
                  transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
                />
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </main>
  )
}
