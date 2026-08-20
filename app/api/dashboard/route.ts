// TARGET PATH: app/api/dashboard/route.ts
import { NextRequest } from "next/server";
import { supabase, supabaseAsUser } from "@/lib/supabase";

// Ignore attempt-to-attempt swings smaller than this fraction of the
// previous score — avoids labeling noise (e.g. 6.0 -> 6.2) as a "trend".
const TREND_DEADZONE_PCT = 0.05;

type TrendDirection = "up" | "down" | "flat" | "insufficient";

interface CandidateAttempt {
  sessionId: string;
  interviewId: string;
  interviewTitle: string;
  overallScore: number | null;
  createdAt: string;
  coding: {
    aiScore: number | null;
    testsPassed: number | null;
    testsTotal: number | null;
    language: string | null;
  } | null;
}

interface CandidateProfile {
  email: string;
  name: string | null;
  attempts: CandidateAttempt[];
  trend: TrendDirection;
  latestScore: number | null;
  bestScore: number | null;
}

// Trend is based on overall_score (Q&A) only, same signal the existing
// avgScore/interviewAvg stats already use — keeps the headline number
// consistent everywhere on the dashboard rather than inventing a separate
// blended metric here.
function computeTrend(scoredAttemptsAsc: number[]): TrendDirection {
  if (scoredAttemptsAsc.length < 2) return "insufficient";
  const prev = scoredAttemptsAsc[scoredAttemptsAsc.length - 2];
  const latest = scoredAttemptsAsc[scoredAttemptsAsc.length - 1];
  const delta = latest - prev;

  if (prev === 0) return delta > 0 ? "up" : "flat";
  if (Math.abs(delta) / prev < TREND_DEADZONE_PCT) return "flat";
  return delta > 0 ? "up" : "down";
}

function buildCandidateProfiles(
  sessions: any[],
  codingBySession: Map<string, any>,
  interviewTitleById: Map<string, string>
): CandidateProfile[] {
  const byEmail = new Map<string, CandidateProfile>();

  for (const s of sessions) {
    // Older sessions predate the candidate_email column, and practice-mode
    // sessions never collect it — neither can be grouped into a profile.
    if (!s.candidate_email) continue;

    const key = s.candidate_email;
    if (!byEmail.has(key)) {
      byEmail.set(key, {
        email: key,
        name: s.candidate_name ?? null,
        attempts: [],
        trend: "insufficient",
        latestScore: null,
        bestScore: null,
      });
    }

    const coding = codingBySession.get(s.id) || null;
    byEmail.get(key)!.attempts.push({
      sessionId: s.id,
      interviewId: s.interview_id,
      interviewTitle: interviewTitleById.get(s.interview_id) ?? "Untitled interview",
      overallScore: s.overall_score,
      createdAt: s.created_at,
      coding: coding
        ? {
            aiScore: coding.ai_score,
            testsPassed: coding.tests_passed,
            testsTotal: coding.tests_total,
            language: coding.language,
          }
        : null,
    });
  }

  const profiles = Array.from(byEmail.values());

  for (const profile of profiles) {
    // Oldest -> newest, so "latest" is always attempts.at(-1)
    profile.attempts.sort(
      (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
    );

    const scored = profile.attempts
      .map((a) => a.overallScore)
      .filter((score): score is number => score !== null);

    profile.latestScore = scored.length ? scored[scored.length - 1] : null;
    profile.bestScore = scored.length ? Math.max(...scored) : null;
    profile.trend = computeTrend(scored);
  }

  // Most recently active candidate first
  return profiles.sort((a, b) => {
    const aLatest = a.attempts.at(-1)?.createdAt ?? "";
    const bLatest = b.attempts.at(-1)?.createdAt ?? "";
    return bLatest.localeCompare(aLatest);
  });
}

export async function GET(req: NextRequest) {
  try {
    // Verify the recruiter is logged in
    const authHeader = req.headers.get("authorization") || "";
    const token = authHeader.replace("Bearer ", "");

    if (!token) {
      return Response.json({ error: "Not authenticated." }, { status: 401 });
    }

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser(token);

    if (authError || !user) {
      return Response.json({ error: "Not authenticated." }, { status: 401 });
    }

    // Use a per-request client that forwards the recruiter's JWT, so
    // RLS policies keyed on auth.uid() resolve correctly.
    const db = supabaseAsUser(token);

    // Get only this recruiter's interviews
    const { data: interviews, error: interviewsError } = await db
      .from("interviews")
      .select("*")
      .eq("recruiter_id", user.id)
      .order("created_at", { ascending: false });

    if (interviewsError) {
      return Response.json({ error: "Failed to load interviews." }, { status: 500 });
    }

    const interviewIds = interviews.map((i) => i.id);

    // Get only sessions belonging to this recruiter's interviews
    const { data: sessions, error: sessionsError } =
      interviewIds.length > 0
        ? await db
            .from("sessions")
            .select("*")
            .in("interview_id", interviewIds)
            .order("created_at", { ascending: false })
        : { data: [], error: null };

    if (sessionsError) {
      return Response.json({ error: "Failed to load sessions." }, { status: 500 });
    }

    const sessionIds = sessions.map((s) => s.id);

    // Get coding submissions linked to those sessions (session_id may be null
    // on older rows created before that column existed — those just won't match)
    const { data: codingSessions, error: codingError } =
      sessionIds.length > 0
        ? await db
            .from("coding_sessions")
            .select("*")
            .in("session_id", sessionIds)
            .order("created_at", { ascending: false })
        : { data: [], error: null };

    if (codingError) {
      return Response.json({ error: "Failed to load coding sessions." }, { status: 500 });
    }

    // Most recent coding submission per session_id (defensive — should be 1:1)
    const codingBySession = new Map<string, (typeof codingSessions)[number]>();
    for (const cs of codingSessions) {
      if (cs.session_id && !codingBySession.has(cs.session_id)) {
        codingBySession.set(cs.session_id, cs);
      }
    }

    // ---------- Stats ----------
    const totalInterviews = interviews.length;
    const totalSessions = sessions.length;

    const scoredSessions = sessions.filter((s) => s.overall_score !== null);
    const avgScore =
      scoredSessions.length > 0
        ? scoredSessions.reduce((sum, s) => sum + Number(s.overall_score), 0) /
          scoredSessions.length
        : 0;

    const scoredCoding = codingSessions.filter((c) => c.ai_score !== null);
    const avgCodingScore =
      scoredCoding.length > 0
        ? scoredCoding.reduce((sum, c) => sum + Number(c.ai_score), 0) / scoredCoding.length
        : 0;

    // ---------- Candidate profiles (grouped across all of this recruiter's interviews) ----------
    const interviewTitleById = new Map(
      interviews.map((i) => [i.id, i.job_description?.slice(0, 60) || "Untitled interview"])
    );
    const candidateProfiles = buildCandidateProfiles(sessions, codingBySession, interviewTitleById);

    // ---------- Interviews with nested candidates ----------
    const interviewsWithStats = interviews.map((interview) => {
      const relatedSessions = sessions.filter((s) => s.interview_id === interview.id);
      const relatedScored = relatedSessions.filter((s) => s.overall_score !== null);
      const interviewAvg =
        relatedScored.length > 0
          ? relatedScored.reduce((sum, s) => sum + Number(s.overall_score), 0) /
            relatedScored.length
          : null;

      const candidates = relatedSessions.map((s) => {
        const coding = codingBySession.get(s.id) || null;
        return {
          sessionId: s.id,
          created_at: s.created_at,
          overallScore: s.overall_score,
          overallFeedback: s.overall_feedback,
          coding: coding
            ? {
                aiScore: coding.ai_score,
                testsPassed: coding.tests_passed,
                testsTotal: coding.tests_total,
                language: coding.language,
              }
            : null,
        };
      });

      return {
        id: interview.id,
        job_description: interview.job_description,
        created_at: interview.created_at,
        candidateCount: relatedSessions.length,
        avgScore: interviewAvg,
        candidates,
      };
    });

    return Response.json({
      stats: {
        totalInterviews,
        totalSessions,
        avgScore: Math.round(avgScore * 10) / 10,
        avgCodingScore: Math.round(avgCodingScore * 10) / 10,
      },
      interviews: interviewsWithStats,
      candidateProfiles,
    });
  } catch (err) {
    console.error("dashboard error:", err);
    return Response.json({ error: "Something went wrong loading dashboard." }, { status: 500 });
  }
}
