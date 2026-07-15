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

// ─── How It Works data ──────────────────────────────────────────────────────

const HOW_IT_WORKS = [
  {
    num: '01',
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M9.5 2A2.5 2.5 0 0 1 12 4.5v15a2.5 2.5 0 0 1-4.96.44 2.5 2.5 0 0 1-2.96-3.08 3 3 0 0 1-.34-5.58 2.5 2.5 0 0 1 1.32-4.24 2.5 2.5 0 0 1 1.98-3A2.5 2.5 0 0 1 9.5 2Z" />
        <path d="M14.5 2A2.5 2.5 0 0 0 12 4.5v15a2.5 2.5 0 0 0 4.96.44 2.5 2.5 0 0 0 2.96-3.08 3 3 0 0 0 .34-5.58 2.5 2.5 0 0 0-1.32-4.24 2.5 2.5 0 0 0-1.98-3A2.5 2.5 0 0 0 14.5 2Z" />
      </svg>
    ),
    title: 'Multi-Timeframe AI',
    desc: 'Qwen LLM reads 15m + 4h candle data and reasons through every Smart Money Concept — Break of Structure, Order Blocks, Fair Value Gaps, Liquidity Sweeps — before touching a single trade.',
  },
  {
    num: '02',
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
        <path d="M7 11V7a5 5 0 0 1 10 0v4" />
      </svg>
    ),
    title: 'On-Chain Governance',
    desc: 'Every trade decision is validated by a smart contract on Base Sepolia. The Policy Engine enforces minimum R:R of 1.5, drawdown caps, and confidence thresholds. No shortcuts.',
  },
  {
    num: '03',
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
      </svg>
    ),
    title: 'Auto Settlement',
    desc: 'Wins flow from the treasury to your wallet. Losses flow out. Every settlement is an on-chain transaction — transparent, auditable, and trustless. No middleman.',
  },
]

const TECH_STACK = [
  'Qwen LLM',
  'Base Sepolia',
  'FastAPI',
  'CCXT',
  'Lightweight Charts',
  'Next.js',
]

// ─── Shared animation variants ───────────────────────────────────────────────

const fadeUp = {
  hidden: { opacity: 0, y: 32 },
  visible: { opacity: 1, y: 0 },
}

const stagger = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.12 } },
}

// ─── Page ────────────────────────────────────────────────────────────────────

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
                <img
                  src="/logo.jpg"
                  alt="Kyma"
                  className="mb-6 h-16 w-16 rounded-2xl object-contain opacity-90 drop-shadow-[0_0_24px_rgba(163,230,53,0.4)]"
                />
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

      {/* ═══════════════════════════════════════════════════════════════════════
          HOW IT WORKS — appears below the sticky 3-D intro as a normal section
          ═══════════════════════════════════════════════════════════════════════ */}
      <section className="relative border-t border-line bg-black px-6 py-24 md:px-12 lg:px-24">

        {/* ── Section heading ──────────────────────────────────────────────── */}
        <motion.div
          className="relative z-10 mb-16 text-center"
          variants={fadeUp}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true }}
          transition={{ duration: 0.6, ease: 'easeOut' }}
        >
          <p className="mb-3 font-mono text-[10px] uppercase tracking-[0.4em] text-acid">
            // architecture
          </p>
          <h2 className="font-mono text-3xl font-bold tracking-tight text-ink md:text-4xl">
            SYSTEM_SPECS
          </h2>
          <p className="mt-4 font-mono text-[11px] text-ink-mute tracking-[0.2em] uppercase">
            Three layers. Fully transparent.
          </p>
        </motion.div>

        {/* ── Cards row ────────────────────────────────────────────────────── */}
        <motion.div
          className="relative z-10 grid grid-cols-1 gap-6 md:grid-cols-3"
          variants={stagger}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true }}
        >
          {HOW_IT_WORKS.map((card) => (
            <motion.div
              key={card.num}
              variants={fadeUp}
              transition={{ duration: 0.55, ease: 'easeOut' }}
              className="group relative flex flex-col border border-line bg-surface-1"
            >
              {/* Terminal Header */}
              <div className="flex h-8 items-center justify-between border-b border-line bg-surface-2/50 px-3">
                <span className="font-mono text-[9px] uppercase tracking-[0.25em] text-ink-mute">
                  SYS.MOD.{card.num}
                </span>
                <span className="flex gap-1.5">
                  <div className="h-1.5 w-1.5 rounded-full bg-line" />
                  <div className="h-1.5 w-1.5 rounded-full bg-line" />
                  <div className="h-1.5 w-1.5 rounded-full bg-acid/40" />
                </span>
              </div>

              <div className="flex flex-1 flex-col p-6">
                <div className="mb-4 text-acid">
                  {card.icon}
                </div>
                <h3 className="mb-3 font-mono text-[13px] font-bold uppercase tracking-wide text-ink">
                  {card.title}
                </h3>
                <p className="flex-1 font-mono text-[11px] leading-relaxed text-ink-fade">
                  {card.desc}
                </p>
              </div>
              
              {/* Bottom accent */}
              <div className="h-[2px] w-full bg-gradient-to-r from-acid/40 to-transparent opacity-0 transition duration-300 group-hover:opacity-100" />
            </motion.div>
          ))}
        </motion.div>

        {/* ── Tech Stack ───────────────────────────────────────────────────── */}
        <motion.div
          className="relative z-10 mt-20 flex flex-col items-center gap-6"
          variants={fadeUp}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true }}
          transition={{ duration: 0.6, ease: 'easeOut', delay: 0.1 }}
        >
          <p className="font-mono text-[10px] uppercase tracking-[0.4em] text-ink-mute">
            Built With
          </p>
          <div className="flex flex-wrap justify-center gap-3">
            {TECH_STACK.map((tech) => (
              <span
                key={tech}
                className="border border-line bg-surface-1 px-3 py-1 font-mono text-[10px] uppercase tracking-[0.2em] text-ink-mute transition hover:border-acid/40 hover:text-acid"
              >
                {tech}
              </span>
            ))}
          </div>
        </motion.div>
      </section>

      {/* ═══════════════════════════════════════════════════════════════════════
          FOOTER
          ═══════════════════════════════════════════════════════════════════════ */}
      <footer className="border-t border-white/[0.06] bg-surface-0 px-6 py-10 md:px-12 lg:px-24">
        <motion.div
          className="flex flex-col items-center gap-6 md:flex-row md:justify-between"
          variants={fadeUp}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true }}
          transition={{ duration: 0.5, ease: 'easeOut' }}
        >
          {/* Brand */}
          <div className="flex items-center gap-3">
            <img
              src="/logo.jpg"
              alt="Kyma"
              className="h-8 w-8 rounded-lg object-contain opacity-80"
            />
            <div className="flex flex-col leading-tight">
              <span className="font-display text-sm font-bold tracking-wide text-white">
                Kyma Terminal
              </span>
              <span className="font-mono text-[10px] text-white/30 tracking-widest">
                Built for OKX Hackathon 
              </span>
            </div>
          </div>

          {/* Links */}
          <div className="flex items-center gap-6">
            <a
              href="https://github.com/0xblaize/Kyma"
              target="_blank"
              rel="noopener noreferrer"
              className="font-mono text-[11px] tracking-widest text-white/40 transition hover:text-acid"
            >
              GitHub
            </a>
            <a
              href="/"
              className="font-mono text-[11px] tracking-widest text-white/40 transition hover:text-acid"
            >
              Docs
            </a>
          </div>
        </motion.div>

        {/* Copyright */}
        <motion.p
          className="mt-8 text-center font-mono text-[10px] tracking-widest text-white/20"
          variants={fadeUp}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true }}
          transition={{ duration: 0.5, ease: 'easeOut', delay: 0.15 }}
        >
          © {new Date().getFullYear()} Kyma Terminal. All rights reserved.
        </motion.p>
      </footer>
    </main>
  )
}
