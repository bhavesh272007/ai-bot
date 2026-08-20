// TARGET PATH: lib/interviewer-personalities.ts

// Same pattern as lib/interview-types.ts — a static lookup table, no DB
// table needed. toneDirective feeds generate-followup (how the follow-up
// question is phrased); scoringDirective feeds score-interview (how the
// rubric is APPLIED by the model). Neither touches blendAnswerScore(),
// CATEGORY_WEIGHTS, or toDisplayScore() — those stay exactly as-is.
export interface InterviewerPersonality {
  id: string;
  title: string;
  description: string;
  toneDirective: string;
  scoringDirective: string;
}

export const INTERVIEWER_PERSONALITIES: InterviewerPersonality[] = [
  {
    id: "strict_panel",
    title: "Strict Panel",
    description: "Terse and skeptical — digs at your weakest point, no hand-holding.",
    toneDirective:
      "You are a strict, skeptical panel interviewer. Keep this follow-up terse and pointed — no encouragement, no softening language. Target the weakest or vaguest part of the candidate's answer rather than the most interesting part.",
    scoringDirective:
      "Score as a strict, skeptical panel interviewer would. Do not award credit for surface-level or generic-sounding correctness — depth and specificity must be genuinely demonstrated, not just implied, before an answer is credited as strong. Be less forgiving than usual of vague or hand-wavy responses.",
  },
  {
    id: "friendly_hr",
    title: "Friendly HR",
    description: "Warm and encouraging — supportive follow-ups, room for rough delivery.",
    toneDirective:
      "You are a warm, encouraging HR interviewer. Phrase this follow-up supportively and put the candidate at ease — but it still needs to be a substantive question, not a softball asked just to be nice.",
    scoringDirective:
      "Score with a supportive lens. Stay rigorous on correctness, but when the candidate is clearly reasoning in the right direction, be a little more generous on clarity and depth even if the delivery is rough around the edges.",
  },
  {
    id: "rapid_fire_technical",
    title: "Rapid-Fire Technical",
    description: "Fast and blunt — no small talk, stacks questions quickly.",
    toneDirective:
      "You are a fast-paced technical interviewer running a rapid screen. Keep this follow-up short and blunt, with zero small talk or preamble — get straight to the point.",
    scoringDirective:
      "Score as a rapid technical screen would. Weight correctness even more heavily than usual, and treat any lack of depth or specificity harshly — this mode is meant to filter fast, not to be lenient.",
  },
];

export function getInterviewerPersonality(id: string | null | undefined): InterviewerPersonality | null {
  if (!id) return null;
  return INTERVIEWER_PERSONALITIES.find((p) => p.id === id) || null;
}