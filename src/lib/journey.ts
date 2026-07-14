import { PHASE } from './phases'

// ────────────────────────────────────────────────────────────────────────────
// Sub-beats INSIDE the "data" phase (step 3 / the second scroll).
// The mannequin turns entirely around, walks through a door, down the
// staircase, through a second door, and arrives at the massive desktop.
//
// Every value is 0→1, so your 3D layer and the preview share the exact same
// timing. Read them from `dataBeats(phase, phaseProgress)`.
// ────────────────────────────────────────────────────────────────────────────

export interface DataBeats {
  turn: number //   0→1 — rotate to back view
  door1: number //  0→1 — approach + pass through first door
  stairs: number // 0→1 — descend the staircase
  door2: number //  0→1 — pass through second door
  desk: number //   0→1 — arrive, desktop revealed
}

/** Clamped, normalized progress of a sub-segment [a,b] within 0→1 `p`. */
function seg(p: number, a: number, b: number) {
  return Math.max(0, Math.min(1, (p - a) / (b - a)))
}

export function dataBeats(phase: number, phaseProgress: number): DataBeats {
  // Before the data phase everything is 0; after it, everything is done (1).
  const p = phase < PHASE.data ? 0 : phase > PHASE.data ? 1 : phaseProgress
  return {
    turn: seg(p, 0.0, 0.22),
    door1: seg(p, 0.22, 0.42),
    stairs: seg(p, 0.4, 0.68),
    door2: seg(p, 0.68, 0.84),
    desk: seg(p, 0.84, 1.0),
  }
}

/** 0 at the edges of a transition, 1 at its midpoint — for the door blackout. */
export function bell(x: number) {
  return Math.sin(Math.PI * Math.max(0, Math.min(1, x)))
}
