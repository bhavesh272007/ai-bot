// TARGET PATH: app/api/weekly-challenge/submit/route.ts
import Groq from "groq-sdk";
import { NextRequest } from "next/server";
import { supabase } from "@/lib/supabase";

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

function isValidEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

// Mirrors score-interview's blendAnswerScore exactly (0.7 correctness /
// 0.2 depth / 0.1 clarity) — kept as a local copy rather than a shared
// import so this route has no dependency on score-interview's internals.
// If that formula ever changes, update both intentionally.
function blendAnswerScore(correctness: number, clarity: number, depth: number): number {
  const raw = correctness * 0.7 + depth * 0.2 + clarity * 0.1;
  const clamped = Math.max(0, Math.min(10, raw));
  return Math.round(clamped * 10) / 10;
}

export async function POST(req: NextRequest) {
  try {
    const { challengeId, email, answerText } = await req.json();

    if (!challengeId || typeof challengeId !== "string") {
      return Response.json({ error: "Missing challenge." }, { status: 400 });
    }
    const trimmedEmail = typeof email === "string" ? email.trim().toLowerCase() : "";
    if (!isValidEmail(trimmedEmail)) {
      return Response.json({ error: "Enter a valid email." }, { status: 400 });
    }
    const trimmedAnswer = typeof answerText === "string" ? answerText.trim() : "";
    if (trimmedAnswer.length < 15) {
      return Response.json({ error: "Write a bit more before submitting." }, { status: 400 });
    }

    const { data: challenge, error: challengeError } = await supabase
      .from("weekly_challenges")
      .select("*")
      .eq("id", challengeId)
      .single();

    if (challengeError || !challenge) {
      return Response.json({ error: "This week's challenge could not be found." }, { status: 404 });
    }

    const prompt = `You are an expert technical interviewer evaluating one candidate's answer to a weekly practice challenge question, part of engineering placement prep in India.

Question:
"${challenge.question_text}"

Candidate's answer:
"${trimmedAnswer}"

Score three separate criteria, each out of 10:
- "correctness": technical accuracy and relevance of the answer
- "clarity": how clearly and coherently the answer is structured and explained
- "depth": how deep the understanding shown is — specificity, examples, reasoning, not just surface-level statements

Be honest and specific — do not give inflated scores for vague or incorrect answers.

Return ONLY a valid JSON object, no markdown formatting, no code fences, no extra text, in exactly this shape:
{"correctness": 7, "clarity": 8, "depth": 6, "strengths": "...", "improvements": "..."}`;

    const completion = await groq.chat.completions.create({
      model: "openai/gpt-oss-120b",
      messages: [{ role: "user", content: prompt }],
      temperature: 0.3,
      response_format: { type: "json_object" },
    });

    const rawText = completion.choices[0]?.message?.content || "";
    let cleaned = rawText.replace(/```json|```/g, "").trim();
    const firstBrace = cleaned.indexOf("{");
    const lastBrace = cleaned.lastIndexOf("}");
    if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
      cleaned = cleaned.slice(firstBrace, lastBrace + 1);
    }

    let parsed: { correctness?: number; clarity?: number; depth?: number; strengths?: string; improvements?: string };
    try {
      parsed = JSON.parse(cleaned);
    } catch (parseErr) {
      console.error("Failed to parse weekly challenge scoring response:", rawText);
      return Response.json({ error: "Failed to score your answer. Please try again." }, { status: 500 });
    }

    const score = blendAnswerScore(
      Number(parsed.correctness) || 0,
      Number(parsed.clarity) || 0,
      Number(parsed.depth) || 0
    );

    // Insert without a subsequent .select() — same reasoning as
    // score-interview's session insert: anon has no SELECT policy on this
    // table, and Supabase's implicit RETURNING on .select().single() would
    // hit the same 42501 block a direct SELECT would, even though the
    // insert's WITH CHECK passes fine on its own. We already have the score
    // and feedback in memory, so nothing needs to be read back.
    const { error: insertError } = await supabase.from("weekly_challenge_attempts").insert({
      challenge_id: challengeId,
      candidate_email: trimmedEmail,
      answer_text: trimmedAnswer,
      score,
      strengths: parsed.strengths || null,
      improvements: parsed.improvements || null,
    });

    if (insertError) {
      // 23505 = unique_violation — candidate already attempted this
      // week's challenge (challenge_id, candidate_email) is unique.
      if (insertError.code === "23505") {
        return Response.json(
          { error: "You've already submitted an answer for this week's challenge." },
          { status: 409 }
        );
      }
      console.error("Failed to save weekly challenge attempt:", insertError);
      return Response.json({ error: "Failed to save your attempt." }, { status: 500 });
    }

    const { data: stats, error: statsError } = await supabase.rpc("get_weekly_challenge_stats", {
      p_challenge_id: challengeId,
    });

    if (statsError) {
      console.error("Failed to load weekly challenge stats after submit:", statsError);
    }

    return Response.json({
      score,
      strengths: parsed.strengths || "",
      improvements: parsed.improvements || "",
      stats: stats || { average_score: 0, attempt_count: 0 },
    });
  } catch (err) {
    console.error("weekly-challenge submit error:", err);
    return Response.json({ error: "Something went wrong scoring your answer." }, { status: 500 });
  }
}