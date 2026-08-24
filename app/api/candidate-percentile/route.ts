// TARGET PATH: app/api/candidate-percentile/route.ts
//
// Corrected to match the confirmed pattern from
// candidate-session-detail/route.ts (inline createClient) rather than my
// earlier guess of a shared lib/supabase.ts export — that guess turned out
// not to match how this project's other anon/candidate-facing routes work.
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

function isValidEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

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

  const { data, error } = await supabase.rpc("get_candidate_percentile", {
    p_email: email.trim().toLowerCase(),
  });

  if (error) {
    console.error("get_candidate_percentile error:", error);
    return NextResponse.json({ error: "Failed to compute percentile." }, { status: 500 });
  }

  // data shape: { percentile: number | null, sample_size: number }
  return NextResponse.json(data);
}