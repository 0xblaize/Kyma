'use client'

// Auxiliary header chip. The spec routes the live system status to the
// center; this small pill stays as a quiet placeholder until a real ticker
// feed lands. Hidden below xl breakpoint so it never crowds the header.
export default function TickerStream() {
  return (
    <div className="flex h-10 items-center gap-2 rounded-xl border border-line bg-surface-1 px-3">
      <span className="h-1.5 w-1.5 rounded-full bg-ink-fade" />
      <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-ink-fade">
        Ticker offline
      </span>
    </div>
  )
}
