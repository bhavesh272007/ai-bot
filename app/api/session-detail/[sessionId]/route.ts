// TARGET PATH: app/api/session-detail/[sessionId]/route.ts
//
// JSON sibling to app/api/session-report/[sessionId]/route.ts — same data
// source (the get_session_report RPC), same "anyone holding the sessionId
// can read it" security model as the existing PDF route, just reshaped for
// inline dashboard rendering instead of a PDF download.

import { NextRequest } from "next/server";
import { supabase } from "@/lib/supabase";

// Fixed display order for the subjects that come from question categories —
// anything outside this list (or missing entirely) falls back to "General"
// and is appended after the known ones.
const SUBJECT_ORDER = ["DSA", "CS Fundamentals", "Experience", "Behavioral"];

interface SessionReportData {
  session: any;
  answers: any[];
  interview: any;
  coding_session: any;
  coding_question: any;
}

interface SubjectScore {
  subject: string;
  average: number; // 0–10, raw — scale to /100 at display time
  count: number;
}

function buildSubjectBreakdown(answers: any[]): SubjectScore[] {
  const buckets = new Map<string, number[]>();

  for (const a of answers) {
    if (a.score === null || a.score === undefined) continue;
    const key = a.category || "General";
    if (!buckets.has(key)) buckets.set(key, []);
    buckets.get(key)!.push(Number(a.score));
  }

  const entries = Array.from(buckets.entries()).map(([subject, scores]) => ({
    subject,
    average: Math.round((scores.reduce((sum, v) => sum + v, 0) / scores.length) * 10) / 10,
    count: scores.length,
  }));

  entries.sort((a, b) => {
    const ai = SUBJECT_ORDER.indexOf(a.subject);
    const bi = SUBJECT_ORDER.indexOf(b.subject);
    if (ai === -1 && bi === -1) return a.subject.localeCompare(b.subject);
    if (ai === -1) return 1;
    if (bi === -1) return -1;
    return ai - bi;
  });

  return entries;
}

// Pull non-empty strengths/improvements across all answers, deduped,
// capped to a reasonable number for inline display — the full per-question
// detail is still available in the PDF report if someone wants everything.
function collectNotes(answers: any[], field: "strengths" | "improvements", limit = 6): string[] {
  const seen = new Set<string>();
  const notes: string[] = [];
  for (const a of answers) {
    const text = (a[field] || "").trim();
    if (!text || seen.has(text)) continue;
    seen.add(text);
    notes.push(text);
    if (notes.length >= limit) break;
  }
  return notes;
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  try {
    const { sessionId } = await params;

    if (!sessionId) {
      return Response.json({ error: "Missing session id." }, { status: 400 });
    }

    const { data: report, error: reportError } = await supabase
      .rpc("get_session_report", { p_session_id: sessionId })
      .single<SessionReportData>();

    if (reportError || !report || !report.session) {
      return Response.json({ error: "Session not found." }, { status: 404 });
    }

    const { session, answers = [], coding_session: codingSession, coding_question: codingQuestion } = report;

    const subjects = buildSubjectBreakdown(answers);
    if (codingSession?.ai_score !== null && codingSession?.ai_score !== undefined) {
      subjects.push({ subject: "Coding", average: Number(codingSession.ai_score), count: 1 });
    }

    return Response.json({
      overallScore: session.overall_score,
      overallFeedback: session.overall_feedback,
      subjects,
      strengths: collectNotes(answers, "strengths"),
      improvements: collectNotes(answers, "improvements"),
      coding: codingSession
        ? {
            questionTitle: codingQuestion?.title ?? null,
            aiScore: codingSession.ai_score,
            testsPassed: codingSession.tests_passed,
            testsTotal: codingSession.tests_total,
            language: codingSession.language,
            aiFeedback: codingSession.ai_feedback,
          }
        : null,
    });
  } catch (err) {
    console.error("session-detail error:", err);
    return Response.json(
      { error: "Something went wrong loading session detail." },
      { status: 500 }
    );
  }
}
