'use client'

import dynamic from 'next/dynamic'
import { AnimatePresence, motion } from 'framer-motion'
import { useDashboardState } from '@/hooks/dashboard/useDashboardState'
import type { AgentState } from '@/lib/clips'

// Standalone dashboard scene — agent is framed at the desk from the first
// frame, no scrolly journey, no staircase. Client-only because R3F + WebGL.
const DashboardAgentCanvas = dynamic(
  () => import('./DashboardAgentCanvas'),
  { ssr: false },
)

export default function AgentViewport() {
  const { active, paused, terminated } = useDashboardState()

  // Spec §3.3 state machine: active = typing, otherwise sit idle.
  // Terminated overlays a frozen "STANDBY" plate.
  const state: AgentState = active ? 'typing' : 'sit_idle'
  const glow = terminated ? 0.12 : paused ? 0.45 : active ? 1 : 0.6

  const pill = terminated
    ? { dot: '#f43f5e', label: 'terminated · frozen' }
    : paused
      ? { dot: '#eab308', label: 'paused · standby' }
      : active
        ? { dot: '#10b981', label: 'live · processing' }
        : { dot: '#71717a', label: 'idle · awaiting deploy' }

  return (
    <div className="relative h-full w-full overflow-hidden bg-surface-0">
      <DashboardAgentCanvas state={state} screenGlow={glow} />

      {/* Spec §3.1: floating LIVE pill, top-left of canvas */}
      <div className="pointer-events-none absolute left-5 top-5 flex items-center gap-2 rounded-full bg-black/50 px-3 py-1.5 backdrop-blur-sm">
        <span className="relative flex h-1.5 w-1.5">
          {active && (
            <span
              className="absolute inset-0 rounded-full animate-ping"
              style={{ backgroundColor: pill.dot, opacity: 0.65 }}
            />
          )}
          <span
            className="relative h-1.5 w-1.5 rounded-full"
            style={{ backgroundColor: pill.dot, boxShadow: `0 0 10px ${pill.dot}` }}
          />
        </span>
        <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-ink-dim">
          {pill.label}
        </span>
      </div>

      {/* Spec §3.1 header */}
      <div className="pointer-events-none absolute right-5 top-5 rounded-md border border-line bg-surface-1/70 px-2.5 py-1 font-mono text-[10px] uppercase tracking-[0.22em] text-ink-mute backdrop-blur">
<<<<<<< HEAD
        kyma · viewport
=======
        agent.os · viewport
>>>>>>> 329e9be2135d833cd4216995a8008f2985cca82d
      </div>

      <AnimatePresence>
        {terminated && (
          <motion.div
            className="pointer-events-none absolute inset-0 flex items-center justify-center bg-surface-0/60 backdrop-blur-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <div className="rounded-md border border-loss/50 bg-surface-1/90 px-6 py-3 font-mono text-[11px] font-semibold uppercase tracking-[0.32em] text-loss">
              ⏻ standby · agent terminated
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
