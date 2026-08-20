// TARGET PATH: lib/panel-mode.ts

// Panel mode reuses the existing question `category` field rather than
// adding a new column — technical vs. behavioral is fully deterministic
// from category, so there's nothing new to persist per-question. Only
// `interviews.is_panel_mode` is new (whether the candidate opted in).
export type InterviewerRole = "technical" | "behavioral";

const TECHNICAL_CATEGORIES = new Set(["CS Fundamentals", "DSA"]);

export function getInterviewerRole(category: string): InterviewerRole {
  return TECHNICAL_CATEGORIES.has(category) ? "technical" : "behavioral";
}

export const PANEL_ROLE_LABELS: Record<InterviewerRole, string> = {
  technical: "Technical Interviewer",
  behavioral: "Behavioral Interviewer",
};