// ────────────────────────────────────────────────────────────────────────────
// The 6 phases of the Kyma landing experience.
// Each phase = roughly one viewport-height of scroll. Your 3D layer reads the
// `phase` index + `phaseProgress` (0→1 within that phase) to drive the model.
// ────────────────────────────────────────────────────────────────────────────

export const PHASES = [
  { id: 'intro', label: 'Kyma' }, //   0 — big name + zigzag box flying around
  { id: 'morph', label: 'Morph' }, //      1 — box snaps to center, becomes mannequin
  { id: 'data', label: 'Desktop' }, //     2 — mannequin turns, massive desktop / charts
  { id: 'shadows', label: 'Shadows' }, //  3 — sits at desk, obscured / dark
  { id: 'fusion', label: 'Execution' }, // 4 — system + mannequin + chair fuse into one
  { id: 'cta', label: 'Get Started' }, //  5 — final scroll, Get Started pops up
] as const

export type Phase = (typeof PHASES)[number]
export type PhaseId = Phase['id']

export const PHASE_COUNT = PHASES.length

/** Index of a phase by id — handy for comparisons in components. */
export const PHASE = Object.fromEntries(
  PHASES.map((p, i) => [p.id, i]),
) as Record<PhaseId, number>
