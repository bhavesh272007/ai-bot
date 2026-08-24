// TARGET PATH: lib/interview-types.ts
//
// Shared source of truth for the 4 "type of mock interview" categories.
// Used by:
//   - components/interview-type-cards.tsx (rendering, both landing + practice)
//   - app/practice/page.tsx (selection state)
//   - app/api/generate-practice-questions/route.ts (prompt biasing via promptFocus)

export interface InterviewTypeDef {
  id: string;
  ticketCode: string;
  title: string;
  description: string;
  tags: string[];
  accent: string; // CSS var() reference — resolves per-theme, not a static hex
  /** Server-side only: how this type should bias the Groq question mix. */
  promptFocus: string;
}

export const INTERVIEW_TYPES: InterviewTypeDef[] = [
  {
    id: "behavioral",
    ticketCode: "TYPE 01 · SOFT SKILLS",
    title: "Behavioral Interview Practice",
    description:
      "Master the STAR method with AI-generated behavioral questions on leadership, teamwork, conflict resolution, and problem-solving.",
    tags: ["STAR Method", "Leadership", "Teamwork", "Problem Solving"],
    accent: "#3A5FCD", // distinct blue — was var(--foreground), which is near-black and blended into body text
    promptFocus:
      "6 Behavioral questions (STAR-method style, covering leadership, teamwork, conflict resolution, and problem-solving) and 2 Experience questions. Skip DSA entirely and include at most 1 CS Fundamentals question.",
  },
  {
    id: "technical",
    ticketCode: "TYPE 02 · CS & CODE",
    title: "Technical Interview Practice",
    description:
      "Prepare for coding rounds, system design, and domain-specific technical assessments across software roles.",
    tags: ["Coding Rounds", "System Design", "Data Structures", "Algorithms"],
    accent: "var(--verified)", // light: #2F6E51, dark: #4E9873
    promptFocus:
      "3 DSA questions, 3 CS Fundamentals questions (including at least one system-design-flavored question), 1 Experience question focused on technical project depth, and 1 Behavioral question.",
  },
  {
    id: "hr",
    ticketCode: "TYPE 03 · HR ROUND",
    title: "HR & Situational Interview Practice",
    description:
      "Practice common HR questions, salary negotiation, and situational judgment scenarios. Get feedback on tone and confidence.",
    tags: ["HR Questions", "Salary Negotiation", "Cultural Fit", "Strengths"],
    accent: "var(--seal)", // #C89B3C — same value in both themes
    promptFocus:
      "6 Behavioral questions phrased as HR/situational scenarios (why should we hire you, salary expectations, cultural fit, strengths & weaknesses, situational judgment tests) and 2 Experience questions. Skip DSA entirely and include at most 1 CS Fundamentals question.",
  },
  {
    id: "industry",
    ticketCode: "TYPE 04 · SECTOR FIT",
    title: "Industry-Specific Mock Interviews",
    description:
      "Questions calibrated to real hiring patterns at IT services firms, banks, consulting firms, and startups.",
    tags: ["IT & Software", "Banking & Finance", "Consulting", "Startups"],
    accent: "var(--destructive)", // light: #A63D40, dark: #C24A47
    promptFocus:
      "A balanced mix across all four categories (2 questions each), but calibrate every question's context, terminology, and difficulty specifically to the candidate's target company/industry rather than generic engineering-placement norms.",
  },
];

export function getInterviewType(id: string | null | undefined): InterviewTypeDef | undefined {
  return INTERVIEW_TYPES.find((t) => t.id === id);
}