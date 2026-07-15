'use client'

import { useEffect, useRef } from 'react'
import { useDashboardState, type LogType, type LogModule } from '@/hooks/dashboard/useDashboardState'

// ─────────────────────────────────────────────────────────────────────────────
// ReasoningTerminal — live AI reasoning feed.
// Each log line is color-coded by both module and type for instant scanability.
// ─────────────────────────────────────────────────────────────────────────────

// Module tag colors — each pipeline stage gets a distinct hue
const MODULE_COLOR: Record<LogModule, string> = {
  PERC: 'text-sky-400',       // perception — blue
  SMC:  'text-acid',          // smart money — acid green
  RISK: 'text-amber-400',     // risk policy — amber
  EXEC: 'text-emerald-400',   // execution — emerald
}

// Message body colors by severity
const MESSAGE_COLOR: Record<LogType, string> = {
  INFO:     'text-zinc-300',
  SUCCESS:  'text-emerald-300',
  WARNING:  'text-amber-300',
  CRITICAL: 'text-rose-400',
}

// Module background badge
const MODULE_BG: Record<LogModule, string> = {
  PERC: 'bg-sky-400/10 border-sky-400/20',
  SMC:  'bg-acid/10 border-acid/20',
  RISK: 'bg-amber-400/10 border-amber-400/20',
  EXEC: 'bg-emerald-400/10 border-emerald-400/20',
}

export default function ReasoningTerminal() {
  const {
    terminalLogs,
    active,
    paused,
    terminated,
    lifecycle,
    deployAgent,
    allocatedCapital,
  } = useDashboardState()
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' })
  }, [terminalLogs.length])

  const hasLogs = terminalLogs.length > 0
  const headerState = terminated ? 'halted' : paused ? 'paused' : active ? 'live' : 'idle'

  const headerBadge = {
    live:   'border-acid/40 bg-acid/10 text-acid',
    paused: 'border-amber-400/40 bg-amber-400/10 text-amber-400',
    halted: 'border-rose-400/40 bg-rose-400/10 text-rose-400',
    idle:   'border-line bg-surface-2 text-ink-fade',
  }[headerState]

  return (
    <div className="flex h-full min-h-0 flex-col border-b border-line bg-surface-1">
      {/* Header */}
      <div className="flex h-8 shrink-0 items-center justify-between border-b border-line px-4">
        <div className="flex items-center gap-2">
          <span className="text-[11px] font-semibold tracking-tight text-ink">Reasoning</span>
          <span className={`rounded-sm border px-1.5 py-[1px] font-mono text-[9px] tracking-[0.2em] ${headerBadge}`}>
            {headerState.toUpperCase()}
          </span>
        </div>
        <div className="flex items-center gap-1 font-mono text-[9px]">
          <span className="text-sky-400">PERC</span>
          <span className="text-zinc-600">·</span>
          <span className="text-acid">SMC</span>
          <span className="text-zinc-600">·</span>
          <span className="text-amber-400">RISK</span>
          <span className="text-zinc-600">·</span>
          <span className="text-emerald-400">EXEC</span>
        </div>
      </div>

      {/* Log feed */}
      <div className="relative flex flex-1 min-h-0 flex-col overflow-y-auto bg-black px-4 py-3 font-mono text-[10.5px] leading-[1.6] [scrollbar-width:thin]">
        {!hasLogs ? (
          <div className="flex h-full flex-col items-center justify-center gap-3">
            <img src="/logo.jpg" alt="Kyma" className="h-10 w-10 rounded-lg opacity-30" />
            <div className="flex flex-col items-center gap-1">
              <span className="font-mono text-[10px] uppercase tracking-[0.32em] text-zinc-600">
                {active ? 'warming up…' : 'awaiting deploy'}
              </span>
              <span className="text-[11px] text-zinc-700">
                {active
                  ? 'AI is analyzing market structure…'
                  : 'Deploy the agent to start live reasoning'}
              </span>
            </div>
          </div>
        ) : (
          <>
            {terminalLogs.map((log) => (
              <div key={log.id} className="flex gap-2 whitespace-pre-wrap py-[1px]">
                {/* Timestamp */}
                <span className="shrink-0 text-zinc-600 text-[9.5px]">[{log.time}]</span>
                {/* Module badge */}
                <span className={`shrink-0 rounded border px-1 text-[8.5px] font-bold leading-[1.8] ${MODULE_BG[log.module]} ${MODULE_COLOR[log.module]}`}>
                  {log.module}
                </span>
                {/* Message */}
                <span className={`${MESSAGE_COLOR[log.type]} leading-relaxed`}>
                  {log.message}
                </span>
              </div>
            ))}
            <div ref={bottomRef} />
          </>
        )}
      </div>
    </div>
  )
}
