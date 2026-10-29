// lib/local-interview-store.ts
// In-memory / local fallback store for practice interviews when Supabase is paused or offline.

export interface LocalInterview {
  interviewId: string;
  isPractice: boolean;
  targetRole: string | null;
  targetCompany: string | null;
  targetLevel: string | null;
  interviewerPersonality: string | null;
  isPanelMode: boolean;
  questions: Array<{ category: string; question: string }>;
  createdAt: number;
}

// Global cache persists across Next.js dev server hot-reloads
const globalForStore = globalThis as unknown as {
  _localInterviews?: Map<string, LocalInterview>;
};

export const localInterviewStore =
  globalForStore._localInterviews ?? (globalForStore._localInterviews = new Map<string, LocalInterview>());

export function saveLocalInterview(interview: LocalInterview) {
  localInterviewStore.set(interview.interviewId, interview);
}

export function getLocalInterview(interviewId: string): LocalInterview | null {
  return localInterviewStore.get(interviewId) ?? null;
}
