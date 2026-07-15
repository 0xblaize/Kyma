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
    icon: '🧠',
    title: 'Multi-Timeframe AI Analysis',
    desc: 'Qwen LLM reads 15m + 4h candle data and reasons through every Smart Money Concept — Break of Structure, Order Blocks, Fair Value Gaps, Liquidity Sweeps — before touching a single trade.',
  },
  {
    num: '02',
    icon: '🔒',
    title: 'On-Chain Trade Governance',
    desc: 'Every trade decision is validated by a smart contract on Base Sepolia. The Policy Engine enforces minimum R:R of 1.5, drawdown caps, and confidence thresholds. No shortcuts.',
  },
  {
    num: '03',
    icon: '💸',
    title: 'Automatic PnL Settlement',
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
      <section className="relative border-t border-acid/20 bg-surface-0 px-6 py-24 md:px-12 lg:px-24">

        {/* Ambient glow blob */}
        <div
          aria-hidden
          className="pointer-events-none absolute left-1/2 top-0 h-[420px] w-[700px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-acid/[0.04] blur-[120px]"
        />

        {/* ── Section heading ──────────────────────────────────────────────── */}
        <motion.div
          className="relative z-10 mb-16 text-center"
          variants={fadeUp}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true }}
          transition={{ duration: 0.6, ease: 'easeOut' }}
        >
          <p className="mb-3 font-mono text-[10px] uppercase tracking-[0.4em] text-acid/60">
            Under the hood
          </p>
          <h2 className="font-display text-4xl font-bold tracking-tight text-white md:text-5xl">
            How It Works
          </h2>
          <p className="mt-4 font-mono text-sm text-white/40 tracking-wide">
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
              whileHover={{ y: -6, transition: { duration: 0.2 } }}
              className="group relative flex flex-col gap-5 rounded-2xl border border-white/10 bg-white/5 p-8 backdrop-blur-sm"
            >
              {/* Corner shimmer on hover */}
              <div className="pointer-events-none absolute inset-0 rounded-2xl opacity-0 ring-1 ring-acid/40 transition duration-300 group-hover:opacity-100" />

              {/* Number */}
              <span className="font-mono text-[11px] font-semibold tracking-[0.3em] text-acid">
                {card.num}
              </span>

              {/* Icon */}
              <span className="text-4xl leading-none" role="img" aria-label={card.title}>
                {card.icon}
              </span>

              {/* Title */}
              <h3 className="font-display text-xl font-bold text-white leading-snug">
                {card.title}
              </h3>

              {/* Description */}
              <p className="flex-1 font-mono text-[13px] leading-relaxed text-white/50">
                {card.desc}
              </p>

              {/* Bottom accent line */}
              <div className="h-px w-full bg-gradient-to-r from-acid/60 via-acid/20 to-transparent" />
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
          <p className="font-mono text-[10px] uppercase tracking-[0.4em] text-white/30">
            Built With
          </p>
          <div className="flex flex-wrap justify-center gap-3">
            {TECH_STACK.map((tech) => (
              <span
                key={tech}
                className="rounded-full border border-acid/30 bg-acid/5 px-4 py-1.5 font-mono text-[11px] tracking-widest text-acid transition hover:border-acid/60 hover:bg-acid/10"
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
                Built for OKX Hackathon 2025
              </span>
            </div>
          </div>

          {/* Links */}
          <div className="flex items-center gap-6">
            <a
              href="https://github.com"
              target="_blank"
              rel="noopener noreferrer"
              className="font-mono text-[11px] tracking-widest text-white/40 transition hover:text-acid"
            >
              GitHub
            </a>
            <a
              href="/docs"
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
