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

// Test results are objective ground truth for correctness — they shouldn't be
// second-guessed by the AI's opinion. Quality/efficiency are genuinely
// judgment calls, so that's where the AI's evaluation actually adds value.
export const TEST_WEIGHT = 0.6;
export const AI_QUALITY_WEIGHT = 0.4;

/**
 * Blend objective test results with the AI's quality/efficiency ratings into a
 * single 0–10 coding-round score.
 *
 * Lives here rather than in the route that grades a real submission because the
 * sample round (/api/sample-coding-feedback) grades on the same scale. Two
 * copies of these weights would silently drift, and a demo that scores more
 * generously than the real thing is worse than no demo.
 */
export function blendCodingScore(
  testsPassed: number,
  testsTotal: number,
  codeQuality: number,
  efficiency: number
): number {
  const aiComponent = (codeQuality + efficiency) / 2;

  if (testsTotal <= 0) {
    // No tests to grade against (shouldn't normally happen) — fall back to
    // the AI's judgment alone rather than dividing by zero / zeroing the score.
    return Math.round(Math.max(0, Math.min(10, aiComponent)) * 10) / 10;
  }

  const testComponent = (testsPassed / testsTotal) * 10;
  const raw = testComponent * TEST_WEIGHT + aiComponent * AI_QUALITY_WEIGHT;
  return Math.round(Math.max(0, Math.min(10, raw)) * 10) / 10;
}