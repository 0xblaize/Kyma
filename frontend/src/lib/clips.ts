// ────────────────────────────────────────────────────────────────────────────
//  GLB animation clip map for /public/agent_os.glb
//
//  The clips are exported from Mixamo with generic names ("mixamo.com",
//  "mixamo.com.001" … ".009"), so we map them by INDEX. The indices below were
//  fingerprinted by clip duration + hip motion:
//
//    [8] dur 2.0s,  hip travels +Z 1.3  → WALK (forward locomotion)
//    [5] dur 4.5s,  hips lower  (y -0.3) → SIT DOWN transition
//    [3] dur 16.5s, in place             → SIT IDLE (long relax loop)
//    [4] dur 4.3s,  in place             → TYPING (heavy)
//    [1] dur 1.07s, in place             → STAND IDLE (subtle)
//
//  If a mapping looks wrong, open the scene with `#inspect` in the URL to cycle
//  every clip by index and correct the numbers here. Nothing else needs editing.
// ────────────────────────────────────────────────────────────────────────────

export type AgentState =
  | 'stand_idle'
  | 'thinking'
  | 'walk'
  | 'sit_down'
  | 'sit_idle'
  | 'typing'

/** State → clip index inside the GLB's `animations` array.
 *  Clip 9 (3.27s in-place loop) is the arms-down breathing/looking-around
 *  idle that was added to the rig. */
export const CLIP_INDEX: Record<AgentState, number> = {
  stand_idle: 9,
  thinking: 9, // reuse the standing-idle clip while the thought cloud plays
  walk: 8,
  sit_down: 5,
  sit_idle: 3,
  typing: 4,
}

/** Clips that play once and hold their last frame (transitions). */
export const ONCE_STATES: ReadonlySet<AgentState> = new Set<AgentState>(['sit_down'])

/** Crossfade duration (seconds) when moving between states. */
export const FADE = 0.45
