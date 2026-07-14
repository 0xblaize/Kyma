'use client'

import { useEffect, useRef } from 'react'
import { useDashboardState, type LogType } from '@/hooks/dashboard/useDashboardState'

// Spec §5.1: Live Reasoning Terminal. Pure black bg, modular header with
// muted "perception · smc · risk · execution" tags. Renders log lines from
// the global store with timestamp, module tag, and message — auto-scrolls
// to bottom on each new line via a ref + scrollIntoView.

// Color map — module tags are always acid; message body color shifts by
// log type so CRITICAL / WARNING jump off the wall of text.
const MODULE_COLOR = 'text-acid'

const MESSAGE_COLOR: Record<LogType, string> = {
  INFO: 'text-zinc-300',
  SUCCESS: 'text-emerald-300',
  WARNING: 'text-amber-300',
  CRITICAL: 'text-rose-400',
}

export default function ReasoningTerminal() {
  const { terminalLogs, active, paused, terminated } = useDashboardState()
  const bottomRef = useRef<HTMLDivElement>(null)

  // Crucial UI trick from Vol.2 §3.1 — pin scroll to the bottom on every
  // new line so the terminal always shows the freshest reasoning.
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' })
  }, [terminalLogs.length])

  const hasLogs = terminalLogs.length > 0
  const headerState = terminated ? 'halted' : paused ? 'paused' : active ? 'live' : 'idle'

  return (
    <div className="flex h-full min-h-0 flex-col border-b border-line bg-surface-1">
      {/* Panel header (Spec §1.2) */}
      <div className="flex h-8 items-center justify-between border-b border-line px-4">
        <div className="flex items-center gap-2">
          <span className="text-[11px] font-semibold tracking-tight text-ink">Reasoning</span>
          <span
            className={`rounded-sm border px-1.5 py-[1px] font-mono text-[9px] tracking-[0.2em] ${
              headerState === 'live'
                ? 'border-acid/40 bg-acid/10 text-acid'
                : headerState === 'paused'
                  ? 'border-warn/40 bg-warn/10 text-warn'
                  : headerState === 'halted'
                    ? 'border-loss/40 bg-loss/10 text-loss'
                    : 'border-line bg-surface-2 text-ink-fade'
            }`}
          >
            {headerState.toUpperCase()}
          </span>
        </div>
        <span className="font-mono text-[10px] tracking-[0.18em] text-ink-fade">
          <span className="text-acid">perception</span>
          <span className="mx-1">·</span>
          <span className="text-acid">smc</span>
          <span className="mx-1">·</span>
          <span className="text-acid">risk</span>
          <span className="mx-1">·</span>
          <span className="text-acid">execution</span>
        </span>
      </div>

      {/* Spec §5.1 active feed area — pure black. Overflow-y auto with thin
          custom scrollbar so the timestamps stay vertically aligned. */}
      <div className="relative flex flex-1 min-h-0 flex-col overflow-y-auto bg-black px-4 py-3 font-mono text-[11px] leading-[1.55]">
        {!hasLogs ? (
          <div className="flex flex-1 items-center justify-center">
            <div className="flex flex-col items-center gap-1.5">
              <span className="font-mono text-[10px] uppercase tracking-[0.32em] text-ink-ghost">
                stream {active ? 'live' : 'idle'}
              </span>
              <span className="text-[11px] text-ink-fade/80">
                {active ? 'reasoning feed warming up…' : 'awaiting reasoning feed'}
              </span>
            </div>
          </div>
        ) : (
          <>
            {terminalLogs.map((log) => (
              <div key={log.id} className="flex gap-2 whitespace-pre-wrap">
                <span className="shrink-0 text-zinc-600">[{log.time}]</span>
                <span className={`shrink-0 font-semibold ${MODULE_COLOR}`}>
                  {log.module.padEnd(4, ' ')}
                </span>
                <span className={MESSAGE_COLOR[log.type]}>{log.message}</span>
              </div>
            ))}
            <div ref={bottomRef} />
          </>
        )}
      </div>
    </div>
  )
}
