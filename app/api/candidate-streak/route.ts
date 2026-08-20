// TARGET PATH: app/api/candidate-streak/route.ts
import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

export async function POST(req: NextRequest) {
  try {
    const { email } = await req.json();

    if (!email || typeof email !== "string") {
      return NextResponse.json({ error: "Email is required." }, { status: 400 });
    }

    const { data, error } = await supabase.rpc("get_candidate_streak", {
      p_email: email.trim().toLowerCase(),
    });

    if (error) {
      console.error("get_candidate_streak error:", error);
      return NextResponse.json({ error: "Failed to load streak." }, { status: 500 });
    }

    return NextResponse.json(data);
  } catch (err) {
    console.error("candidate-streak route error:", err);
    return NextResponse.json({ error: "Unexpected error." }, { status: 500 });
  }
}