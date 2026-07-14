'use client'

import { useEffect, useRef, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'

interface TerminalProps {
  /** When true, the agent is processing — stream the live feed. */
  active: boolean
}

const FEED = [
  ['SYS', 'perception loop online — polling market state'],
  ['NET', 'GET /api/v3/klines BTCUSDT 1m → 200 OK'],
  ['AI', 'sentiment vector ingested · score +0.62'],
  ['SMC', 'BOS confirmed @ 64,180 · order block valid'],
  ['RISK', 'sizing position · 1.2% equity · SL 63,800'],
  ['EXEC', 'paper order FIRED · long BTC @ 64,200'],
  ['LOG', 'latency 41ms · throughput 1.2k msg/s'],
  ['AI', 'reinforcement step 8842 · loss 0.0143'],
  ['NET', 'ws://stream heartbeat · 0 dropped'],
  ['SMC', 'liquidity sweep detected · adjusting TP → 65,400'],
] as const

const TONE: Record<string, string> = {
  SYS: 'text-acid',
  NET: 'text-sky-400',
  AI: 'text-fuchsia-400',
  SMC: 'text-amber-400',
  RISK: 'text-rose-400',
  EXEC: 'text-emerald-400',
  LOG: 'text-white/40',
}

interface Line { tag: string; msg: string; id: number }

export default function Terminal({ active }: TerminalProps) {
  const [lines, setLines] = useState<Line[]>([])
  const idRef = useRef(0)
  const feedRef = useRef(0)
  const boxRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!active) return
    const iv = setInterval(() => {
      const [tag, msg] = FEED[feedRef.current % FEED.length]
      feedRef.current++
      setLines((prev) => [...prev.slice(-40), { tag, msg, id: idRef.current++ }])
    }, 420)
    return () => clearInterval(iv)
  }, [active])

  useEffect(() => {
    boxRef.current?.scrollTo({ top: boxRef.current.scrollHeight })
  }, [lines])

  return (
    <AnimatePresence>
      {active && (
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 24 }}
          transition={{ type: 'spring', stiffness: 140, damping: 20 }}
          className="pointer-events-none absolute bottom-6 right-6 z-40 w-[min(440px,42vw)]"
        >
          <div className="overflow-hidden rounded-lg border border-acid/20 bg-black/80 shadow-acid backdrop-blur-md">
            {/* title bar */}
            <div className="flex items-center gap-2 border-b border-white/10 px-3 py-2">
              <span className="h-2.5 w-2.5 rounded-full bg-rose-500/80" />
              <span className="h-2.5 w-2.5 rounded-full bg-amber-400/80" />
              <span className="h-2.5 w-2.5 rounded-full bg-emerald-500/80" />
              <span className="ml-2 font-mono text-[10px] uppercase tracking-[0.3em] text-white/40">
<<<<<<< HEAD
                kyma — live feed
=======
                agent.os — live feed
>>>>>>> 329e9be2135d833cd4216995a8008f2985cca82d
              </span>
              <span className="ml-auto flex items-center gap-1.5 font-mono text-[9px] uppercase tracking-[0.2em] text-acid">
                <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-acid" />
                processing
              </span>
            </div>

            {/* stream */}
            <div ref={boxRef} className="h-44 overflow-hidden px-3 py-2 font-mono text-[11px] leading-relaxed">
              {lines.map((l) => (
                <div key={l.id} className="flex gap-2 whitespace-nowrap">
                  <span className="text-white/25">›</span>
                  <span className={`${TONE[l.tag] ?? 'text-white/50'} w-10 shrink-0 font-semibold`}>
                    {l.tag}
                  </span>
                  <span className="text-white/65">{l.msg}</span>
                </div>
              ))}
              <span className="inline-block h-3 w-2 animate-pulse bg-acid align-middle" />
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
