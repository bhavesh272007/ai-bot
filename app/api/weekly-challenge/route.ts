// TARGET PATH: app/api/weekly-challenge/route.ts
import Groq from "groq-sdk";
import { NextRequest } from "next/server";
import { supabase } from "@/lib/supabase";
import { getISTWeekStartDate } from "@/lib/ist-week";

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

export async function GET(req: NextRequest) {
  try {
    const weekStartDate = getISTWeekStartDate();
    const email = req.nextUrl.searchParams.get("email");

    // Reuse this week's challenge if it already exists — same
    // check-existing-then-generate shape as /api/coding-question/[id].
    const { data: existing, error: existingError } = await supabase
      .from("weekly_challenges")
      .select("*")
      .eq("week_start_date", weekStartDate)
      .maybeSingle();

    if (existingError) {
      console.error("Failed to check existing weekly challenge:", existingError);
      return Response.json({ error: "Failed to load this week's challenge." }, { status: 500 });
    }

    let challenge = existing;

    if (!challenge) {
      const prompt = `You are setting one weekly practice challenge question for a platform helping students prepare for engineering placement interviews in India.

Write ONE standalone, well-defined question that a candidate can answer in a few written paragraphs — NOT a live-coding problem (no stdin/stdout, no test cases). Draw from any of: a CS fundamentals concept explained in depth, a DSA approach described in words (not code), a behavioral/STAR-method scenario, or a system-design-lite conceptual question. Pick whichever makes for the most interesting standalone question this week. Calibrate difficulty to a general entry-level/fresher audience — no company-specific or resume-specific context, since this question goes out to everyone on the platform.

Return ONLY a valid JSON object, no markdown formatting, no code fences, no extra text, in exactly this shape:
{"questionText": "..."}`;

      const completion = await groq.chat.completions.create({
        model: "openai/gpt-oss-120b",
        messages: [{ role: "user", content: prompt }],
        temperature: 0.8,
        response_format: { type: "json_object" },
      });

      const rawText = completion.choices[0]?.message?.content || "";
      let cleaned = rawText.replace(/```json|```/g, "").trim();
      const firstBrace = cleaned.indexOf("{");
      const lastBrace = cleaned.lastIndexOf("}");
      if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
        cleaned = cleaned.slice(firstBrace, lastBrace + 1);
      }

      let generated: { questionText?: string };
      try {
        generated = JSON.parse(cleaned);
      } catch (parseErr) {
        console.error("Failed to parse weekly challenge response. Raw output:", rawText);
        return Response.json({ error: "Failed to generate this week's challenge." }, { status: 500 });
      }

      if (!generated?.questionText) {
        console.error("Weekly challenge response missing questionText:", generated);
        return Response.json({ error: "This week's challenge came back incomplete." }, { status: 500 });
      }

      // If two requests race to generate the same week's challenge, the
      // unique constraint on week_start_date rejects the second insert —
      // fall through and re-fetch the row the other request created.
      const { data: inserted, error: insertError } = await supabase
        .from("weekly_challenges")
        .insert({ question_text: generated.questionText, week_start_date: weekStartDate })
        .select()
        .maybeSingle();

      if (insertError || !inserted) {
        const { data: refetched } = await supabase
          .from("weekly_challenges")
          .select("*")
          .eq("week_start_date", weekStartDate)
          .maybeSingle();

        if (!refetched) {
          console.error("Failed to save weekly challenge:", insertError);
          return Response.json({ error: "Failed to save this week's challenge." }, { status: 500 });
        }
        challenge = refetched;
      } else {
        challenge = inserted;
      }
    }

    const { data: stats, error: statsError } = await supabase.rpc("get_weekly_challenge_stats", {
      p_challenge_id: challenge.id,
    });

    if (statsError) {
      console.error("Failed to load weekly challenge stats:", statsError);
    }

    let myAttempt = null;
    if (email && email.trim()) {
      const { data: attempt, error: attemptError } = await supabase.rpc("get_my_weekly_challenge_attempt", {
        p_challenge_id: challenge.id,
        p_email: email.trim().toLowerCase(),
      });
      if (attemptError) {
        console.error("Failed to load candidate's weekly challenge attempt:", attemptError);
      } else {
        myAttempt = attempt;
      }
    }

    return Response.json({
      challengeId: challenge.id,
      questionText: challenge.question_text,
      weekStartDate: challenge.week_start_date,
      stats: stats || { average_score: 0, attempt_count: 0 },
      myAttempt,
    });
  } catch (err) {
    console.error("weekly-challenge error:", err);
    return Response.json({ error: "Something went wrong loading this week's challenge." }, { status: 500 });
  }
}