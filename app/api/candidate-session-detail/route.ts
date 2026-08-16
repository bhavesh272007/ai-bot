// TARGET PATH: app/api/candidate-session-detail/route.ts
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

function isValidEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

// Candidate-safe equivalent of /api/session-detail/[sessionId] — that route
// trusts the recruiter's JWT (auth.uid()) for ownership. This one has no
// JWT to trust, so ownership is checked by matching the submitted email
// against sessions.candidate_email — done inside
// get_candidate_session_detail() (SECURITY DEFINER) so there's no gap
// between checking and using the result.
export async function POST(req: NextRequest) {
  let sessionId: string;
  let email: string;

  try {
    const body = await req.json();
    sessionId = body.sessionId;
    email = body.email;
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  if (!sessionId || typeof sessionId !== "string") {
    return NextResponse.json({ error: "Missing session id." }, { status: 400 });
  }
  if (!email || typeof email !== "string" || !isValidEmail(email)) {
    return NextResponse.json({ error: "Enter a valid email." }, { status: 400 });
  }

  const { data, error } = await supabase.rpc("get_candidate_session_detail", {
    p_session_id: sessionId,
    p_email: email.trim().toLowerCase(),
  });

  if (error) {
    console.error("get_candidate_session_detail error:", error);
    return NextResponse.json({ error: "Couldn't load this session." }, { status: 500 });
  }

  // null covers both "session doesn't exist" and "session exists but isn't
  // yours" — deliberately indistinguishable so a wrong email can't be used
  // to probe which session ids are real.
  if (!data) {
    return NextResponse.json({ error: "Session not found." }, { status: 404 });
  }

  return NextResponse.json(data);
}