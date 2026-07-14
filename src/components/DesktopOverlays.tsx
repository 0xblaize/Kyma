'use client'

import { motion, AnimatePresence } from 'framer-motion'
import { PHASE } from '@/lib/phases'
import { dataBeats } from '@/lib/journey'

interface DesktopOverlaysProps {
  phase: number
  phaseProgress: number
}

/**
 * Desktop UI: floating glass panels layered OVER your 3D screens. They only
 * appear once the mannequin has finished the journey and ARRIVED at the desk
 * (end of the "data" phase), then linger through "shadows" + "fusion".
 */
export default function DesktopOverlays({ phase, phaseProgress }: DesktopOverlaysProps) {
  const arrived = dataBeats(phase, phaseProgress).desk > 0.15
  const visible = (phase === PHASE.data && arrived) || (phase > PHASE.data && phase <= PHASE.fusion)

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          className="pointer-events-none absolute inset-0 z-20"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.6 }}
        >
          <Panel className="left-[6vw] top-[18vh]" delay={0}>
            <PanelHead>System Training</PanelHead>
            <div className="mt-3 space-y-2">
              {['ingest · ohlcv', 'backprop · epoch 248', 'eval · sharpe 2.1'].map((l) => (
                <div key={l} className="flex items-center gap-2 text-[10px] text-white/45">
                  <span className="h-1 w-1 rounded-full bg-acid" />
                  {l}
                </div>
              ))}
              <div className="mt-3 h-1 w-full overflow-hidden rounded bg-white/10">
                <motion.div
                  className="h-full bg-acid"
                  initial={{ width: '0%' }}
                  animate={{ width: '82%' }}
                  transition={{ duration: 1.6, ease: 'easeOut' }}
                />
              </div>
            </div>
          </Panel>

          <Panel className="right-[6vw] top-[22vh]" delay={0.12}>
            <PanelHead>Trading Charts</PanelHead>
            <Candles />
            <div className="mt-2 font-mono text-[10px] text-acid/80">
              BTC · 64,200 ▲ 1.8%
            </div>
          </Panel>

          <Panel className="left-1/2 bottom-[14vh] -translate-x-1/2" delay={0.24}>
            <PanelHead>Live Chats</PanelHead>
            <div className="mt-3 space-y-2">
              <Bubble side="in">BOS confirmed on 15m</Bubble>
              <Bubble side="out">Long. Entry 64,200 · SL 63,800</Bubble>
              <Bubble side="in">Order block holding ✓</Bubble>
            </div>
          </Panel>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

function Panel({
  children,
  className = '',
  delay = 0,
}: {
  children: React.ReactNode
  className?: string
  delay?: number
}) {
  return (
    <motion.div
      className={`absolute w-[230px] rounded-lg border border-acid/20 bg-black/55 p-4 backdrop-blur-md ${className}`}
      initial={{ opacity: 0, y: 24, scale: 0.96 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.7, delay, ease: [0.16, 1, 0.3, 1] }}
    >
      {children}
    </motion.div>
  )
}

function PanelHead({ children }: { children: React.ReactNode }) {
  return (
    <div className="font-mono text-[9px] uppercase tracking-[0.3em] text-acid/60">
      {children}
    </div>
  )
}

function Bubble({ children, side }: { children: React.ReactNode; side: 'in' | 'out' }) {
  return (
    <div className={`flex ${side === 'out' ? 'justify-end' : 'justify-start'}`}>
      <div
        className={`max-w-[80%] rounded-md px-2.5 py-1.5 text-[10px] leading-snug ${
          side === 'out' ? 'bg-acid/15 text-acid/90' : 'bg-white/10 text-white/55'
        }`}
      >
        {children}
      </div>
    </div>
  )
}

function Candles() {
  // Static decorative candlestick sparkline.
  const bars = [
    { h: 22, up: true },
    { h: 34, up: false },
    { h: 18, up: true },
    { h: 40, up: true },
    { h: 28, up: false },
    { h: 46, up: true },
    { h: 30, up: true },
  ]
  return (
    <svg viewBox="0 0 140 56" className="mt-3 h-14 w-full">
      {bars.map((b, i) => {
        const x = 8 + i * 19
        const y = 50 - b.h
        const color = b.up ? '#a3e635' : 'rgba(255,255,255,0.25)'
        return (
          <g key={i}>
            <line x1={x} x2={x} y1={y - 6} y2={y + b.h + 4} stroke={color} strokeWidth={1} />
            <rect x={x - 4} y={y} width={8} height={b.h} fill={color} rx={1} />
          </g>
        )
      })}
    </svg>
  )
}
