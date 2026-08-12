// TARGET PATH: app/api/score-interview/route.ts
import Groq from "groq-sdk";
import { NextRequest } from "next/server";
import { randomUUID } from "crypto";
import { supabase } from "@/lib/supabase";

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

// Placement interviews conventionally weight technical rounds a bit more
// heavily than behavioral/experience rounds. Applied as a weighted average,
// so a session that's mostly one category (e.g. a Behavioral-focus practice
// session) isn't unfairly penalized — the weights only matter when categories
// are mixed within the same session.
const CATEGORY_WEIGHTS: Record<string, number> = {
  DSA: 1.15,
  "CS Fundamentals": 1.1,
  Experience: 1.0,
  Behavioral: 0.9,
};

function categoryWeight(category: string): number {
  return CATEGORY_WEIGHTS[category] ?? 1.0;
}

// Blend the three rubric sub-scores into one answer score. Correctness
// dominates heavily since technical accuracy matters most in a placement
// interview — a wrong answer shouldn't score well just for being articulate.
function blendAnswerScore(correctness: number, clarity: number, depth: number): number {
  const raw = correctness * 0.7 + depth * 0.2 + clarity * 0.1;
  const clamped = Math.max(0, Math.min(10, raw));
  return Math.round(clamped * 10) / 10;
}

interface RubricAnswer {
  question: string;
  correctness: number;
  clarity: number;
  depth: number;
  strengths: string;
  improvements: string;
}

export async function POST(req: NextRequest) {
  try {
    const { answers, interviewId } = await req.json();

    if (!answers || !Array.isArray(answers) || answers.length === 0) {
      return Response.json(
        { error: "No interview answers provided." },
        { status: 400 }
      );
    }

    const qaText = answers
      .map(
        (a: { category: string; question: string; answer: string }, i: number) =>
          `Q${i + 1} [${a.category}]: ${a.question}\nCandidate's Answer: ${a.answer}`
      )
      .join("\n\n");

    const prompt = `You are an expert technical interviewer evaluating a candidate's performance in an engineering placement interview in India.

Below are the interview questions and the candidate's answers. Evaluate each answer individually against a fixed rubric, then give a qualitative overall impression.

For EACH answer, score three separate criteria, each out of 10:
- "correctness": technical accuracy and relevance of the answer
- "clarity": how clearly and coherently the answer is structured and explained
- "depth": how deep the understanding shown is — specificity, examples, reasoning (not just surface-level statements)

Be honest and specific — do not give inflated scores for vague or incorrect answers. A vague or evasive answer should score low on correctness and depth even if clearly written.

Interview Transcript:
${qaText}

Return ONLY a valid JSON object, no markdown formatting, no code fences, no extra text, in exactly this shape:
{
  "answers": [
    {
      "question": "...",
      "correctness": 7,
      "clarity": 8,
      "depth": 6,
      "strengths": "...",
      "improvements": "..."
    }
  ],
  "overall_feedback": "2-3 sentence qualitative summary of the candidate's overall performance, strengths, and what to work on. Do not state a specific numeric score in this text — a score is calculated separately."
}`;

    const completion = await groq.chat.completions.create({
      model: "llama-3.3-70b-versatile",
      messages: [{ role: "user", content: prompt }],
      temperature: 0.3,
    });

    const rawText = completion.choices[0]?.message?.content || "";
    const cleaned = rawText.replace(/```json|```/g, "").trim();

    let parsed: { answers: RubricAnswer[]; overall_feedback: string };
    try {
      parsed = JSON.parse(cleaned);
    } catch (parseErr) {
      console.error("Failed to parse scoring response:", rawText);
      return Response.json(
        { error: "Failed to parse AI scoring response. Please try again." },
        { status: 500 }
      );
    }

    // ---------- Compute final scores deterministically ----------
    const scoredAnswers = parsed.answers.map((a, i) => {
      const correctness = Number(a.correctness) || 0;
      const clarity = Number(a.clarity) || 0;
      const depth = Number(a.depth) || 0;
      const score = blendAnswerScore(correctness, clarity, depth);
      const category = answers[i]?.category || "Experience";

      return {
        question: a.question,
        score,
        strengths: a.strengths,
        improvements: a.improvements,
        _category: category, // internal only, not persisted or returned
      };
    });

    let weightedSum = 0;
    let weightTotal = 0;
    for (const a of scoredAnswers) {
      const w = categoryWeight(a._category);
      weightedSum += a.score * w;
      weightTotal += w;
    }
    const overall_score = weightTotal > 0 ? Math.round((weightedSum / weightTotal) * 10) / 10 : 0;

    const result = {
      answers: scoredAnswers.map(({ question, score, strengths, improvements }) => ({
        question,
        score,
        strengths,
        improvements,
      })),
      overall_score,
      overall_feedback: parsed.overall_feedback,
    };

    // ---------- Persist ----------
    // Generate the session id ourselves rather than using .select() to read
    // it back after insert. Under RLS, anon has no SELECT policy on
    // `sessions` (by design — see Tier 1), and Supabase's .select() after
    // .insert() issues an implicit RETURNING, which Postgres treats as a
    // read and blocks with the same 42501 error as a direct SELECT would,
    // even though the insert's WITH CHECK passes fine on its own.
    const sessionId = randomUUID();

    const { error: sessionError } = await supabase.from("sessions").insert({
      id: sessionId,
      interview_id: interviewId || null,
      overall_score: result.overall_score,
      overall_feedback: result.overall_feedback,
    });

    if (sessionError) {
      console.error("Failed to save session:", sessionError);
      return Response.json(
        { error: "Failed to save session to database." },
        { status: 500 }
      );
    }

    const answerRows = result.answers.map(
      (a: { question: string; score: number; strengths: string; improvements: string }, i: number) => ({
        session_id: sessionId,
        question_text: a.question,
        answer_text: answers[i]?.answer || "",
        score: a.score,
        strengths: a.strengths,
        improvements: a.improvements,
        order_index: i,
      })
    );

    const { error: answersError } = await supabase
      .from("session_answers")
      .insert(answerRows);

    if (answersError) {
      console.error("Failed to save answers:", answersError);
      return Response.json(
        { error: "Failed to save answers to database." },
        { status: 500 }
      );
    }

    // sessionId is threaded through to the coding round so a candidate's
    // coding submission can be linked back to this same Q&A session.
    return Response.json({ ...result, sessionId });
  } catch (err) {
    console.error("score-interview error:", err);
    return Response.json(
      { error: "Something went wrong scoring the interview." },
      { status: 500 }
    );
  }
}