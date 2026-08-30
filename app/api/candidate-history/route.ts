// TARGET PATH: app/api/candidate-history/route.ts
import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

function isValidEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

// POST, not a GET with ?email= in the query string — keeps the email out of
// server access logs / browser history. Body-only lookup.
export async function POST(req: NextRequest) {
  let email: string;

  try {
    const body = await req.json();
    email = body.email;
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  if (!email || typeof email !== "string" || !isValidEmail(email)) {
    return NextResponse.json({ error: "Enter a valid email." }, { status: 400 });
  }

  // TODO: wire in your existing Upstash rate limiter here (same pattern as
  // your other public routes), keyed by IP and/or the submitted email.
  // This endpoint is a public lookup surface — worth throttling even
  // though the underlying function can't be scanned/enumerated.

  const { data, error } = await supabase.rpc("get_candidate_history", {
    p_email: email.trim().toLowerCase(),
  });

  if (error) {
    console.error("get_candidate_history error:", error);
    return NextResponse.json(
      { error: "Couldn't load your interview history." },
      { status: 500 }
    );
  }

  return NextResponse.json({ sessions: data ?? [] });
}
