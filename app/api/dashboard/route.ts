// TARGET PATH: app/api/dashboard/route.ts
import { NextRequest } from "next/server";
import { supabase, supabaseAsUser } from "@/lib/supabase";

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
    });
  } catch (err) {
    console.error("dashboard error:", err);
    return Response.json({ error: "Something went wrong loading dashboard." }, { status: 500 });
  }
}