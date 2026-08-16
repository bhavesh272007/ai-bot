// TARGET PATH: lib/scoring.ts
//
// All scoring math (rubric weights, Groq prompts, DB storage) stays on the
// original 0–10 scale everywhere — this only converts to /100 at the point
// of display. Keeping the internal scale unchanged means trend deltas,
// averages, and thresholds in scoreColor()-style helpers don't need to
// change anywhere else; only the number and the "/10" vs "/100" label at
// render time do.

/**
 * Convert a raw 0–10 score to its /100 display value.
 * Rounds to the nearest whole number — /100 doesn't need decimal precision
 * the way /10 did.
 */
export function toDisplayScore(rawScore: number): number {
  return Math.round(rawScore * 10);
}