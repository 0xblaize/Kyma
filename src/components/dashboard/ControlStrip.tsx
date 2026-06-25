'use client'

import { useEffect } from 'react'
import { useDashboardState } from '@/hooks/dashboard/useDashboardState'
import { useVaultActions } from '@/hooks/dashboard/useVaultActions'

// Spec §7: Emergency Action Bar. Every button now triggers an on-chain
// vault tx (and therefore a wallet signature) before its corresponding UI
// state advances. Flush is the one exception — it only clears the local
// terminal buffer and stays signature-free.

type Variant = 'danger' | 'neutral' | 'subtle' | 'primary'

interface ButtonProps {
  label: string
  shortcut: string
  variant: Variant
  active?: boolean
  disabled?: boolean
  onClick: () => void
}

const VARIANT: Record<Variant, string> = {
  subtle: 'border border-[#3f3f46] bg-transparent text-ink hover:bg-surface-2',
  neutral: 'border border-line bg-surface-2 text-ink hover:bg-[#1f1f23] active:bg-[#141417]',
  primary: 'bg-acid text-black hover:bg-[#bef264] active:bg-[#84cc16]',
  danger: 'bg-[#e11d48] text-white hover:bg-[#be123c] active:bg-[#9f1239]',
}

function CtrlButton({ label, shortcut, variant, active, disabled, onClick }: ButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`group flex h-7 items-center justify-center gap-1.5 rounded-md px-2.5 text-[10.5px] font-semibold uppercase tracking-[0.08em] transition disabled:cursor-not-allowed disabled:opacity-50 ${VARIANT[variant]} ${
        active ? 'ring-1 ring-warn/60' : ''
      }`}
    >
      <span>{label}</span>
      <span className="rounded-sm border border-current/30 px-1 py-[1px] font-mono text-[9px] tracking-[0.1em] opacity-70">
        {shortcut}
      </span>
    </button>
  )
}

export default function ControlStrip() {
  const { active, paused, terminated, txPhase, flushLogs } = useDashboardState()
  const { togglePaused, terminate, reset } = useVaultActions()

  const txBusy = txPhase === 'approving' || txPhase === 'signing' || txPhase === 'pending'

  // Keyboard shortcuts: T / P / F / R. Ignored while typing in inputs or
  // while a tx is mid-flight (so users don't accidentally fire two sigs).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement ||
        (e.target as HTMLElement)?.isContentEditable
      ) {
        return
      }
      if (txBusy) return
      const k = e.key.toLowerCase()
      if (k === 't') void terminate()
      else if (k === 'p') void togglePaused()
      else if (k === 'f') flushLogs()
      else if (k === 'r') void reset()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [terminate, togglePaused, flushLogs, reset, txBusy])

  return (
    <footer className="flex h-[44px] items-center justify-between gap-3 border-t border-line bg-surface-1 px-4">
      <div className="flex items-center gap-2.5">
        <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-ink-mute">
          Emergency controls
        </span>
        {txBusy && (
          <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-warn">
            {txPhase === 'approving'
              ? 'Approve in wallet…'
              : txPhase === 'signing'
                ? 'Sign in wallet…'
                : 'Confirming tx…'}
          </span>
        )}
      </div>
      <div className="flex items-center gap-2">
        <CtrlButton
          label="Flush logs"
          shortcut="F"
          variant="subtle"
          onClick={flushLogs}
        />
        <CtrlButton
          label={paused ? 'Resume perception' : 'Pause perception'}
          shortcut="P"
          variant="neutral"
          active={paused}
          disabled={(!active && !paused) || txBusy}
          onClick={() => void togglePaused()}
        />
        <CtrlButton
          label="Reset simulation"
          shortcut="R"
          variant="primary"
          disabled={txBusy}
          onClick={() => void reset()}
        />
        <CtrlButton
          label={terminated ? 'Agent halted' : 'Terminate agent'}
          shortcut="T"
          variant="danger"
          active={terminated}
          disabled={txBusy || terminated}
          onClick={() => void terminate()}
        />
      </div>
    </footer>
  )
}
