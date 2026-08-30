// TARGET PATH: app/api/score-coding/route.ts
import Groq from "groq-sdk";
import { NextRequest } from "next/server";
import { supabase } from "@/lib/supabase";

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

interface TestResult {
  passed: boolean;
  input: string;
  expectedOutput: string;
  actualOutput: string;
}

// Test results are objective ground truth for correctness — they shouldn't be
// second-guessed by the AI's opinion. Quality/efficiency are genuinely
// judgment calls, so that's where the AI's evaluation actually adds value.
const TEST_WEIGHT = 0.6;
const AI_QUALITY_WEIGHT = 0.4;

// Meeting mode keeps the mic live through the coding round, so the candidate's
// narration arrives here. It shapes the written feedback only — deliberately
// NOT the score: raw speech-to-text is noisy, and a quiet-but-correct candidate
// shouldn't be marked down for a transcription artefact. Long transcripts get
// truncated so a rambling 20-minute round can't blow out the prompt.
const THINK_ALOUD_CHAR_LIMIT = 4000;

function blendCodingScore(
  testsPassed: number,
  testsTotal: number,
  codeQuality: number,
  efficiency: number
): number {
  const aiComponent = (codeQuality + efficiency) / 2;

  if (testsTotal <= 0) {
    // No tests to grade against (shouldn't normally happen) — fall back to
    // the AI's judgment alone rather than dividing by zero / zeroing the score.
    return Math.round(Math.max(0, Math.min(10, aiComponent)) * 10) / 10;
  }

  const testComponent = (testsPassed / testsTotal) * 10;
  const raw = testComponent * TEST_WEIGHT + aiComponent * AI_QUALITY_WEIGHT;
  return Math.round(Math.max(0, Math.min(10, raw)) * 10) / 10;
}

export async function POST(req: NextRequest) {
  try {
    const {
      interviewId,
      sessionId,
      codingQuestionId,
      language,
      code,
      problemPrompt,
      testResults,
      testsPassed,
      testsTotal,
      thinkAloud,
    } = await req.json();

    if (!code || !code.trim()) {
      return Response.json({ error: "No code submitted." }, { status: 400 });
    }

    const narration =
      typeof thinkAloud === "string" && thinkAloud.trim()
        ? thinkAloud.trim().slice(0, THINK_ALOUD_CHAR_LIMIT)
        : "";

    const testSummary = ((testResults || []) as TestResult[])
      .map(
        (r, i) =>
          `Test ${i + 1}: ${r.passed ? "PASSED" : "FAILED"}\nInput: ${r.input}\nExpected: ${r.expectedOutput}\nActual: ${r.actualOutput}`
      )
      .join("\n\n");

    // Only present when the candidate did the round inside a live meeting with
    // the mic on. Classic mode sends nothing and the prompt is unchanged.
    const narrationBlock = narration
      ? `
The candidate talked through their approach out loud while solving this. Raw speech-to-text transcript (expect disfluencies, missing punctuation and occasional mis-transcriptions — judge the substance, not the wording):
"""
${narration}
"""

Also evaluate:
- "communication": how clearly they explained their approach, trade-offs and debugging as they worked (0-10)
`
      : "";

    const narrationFeedbackAsk = narration
      ? " Include exactly one sentence on how they communicated their thinking out loud."
      : "";

    const narrationSchemaField = narration ? `\n  "communication": 7,` : "";

    const prompt = `You are an expert technical interviewer evaluating a candidate's coding round submission for an engineering placement interview in India.

Problem:
"""
${problemPrompt}
"""

Candidate's language: ${language}

Candidate's code:
"""
${code}
"""

Test results (${testsPassed}/${testsTotal} passed):
${testSummary}
${narrationBlock}
Test correctness is already measured objectively by the test results above — do not re-judge correctness. Instead, evaluate only:
- "codeQuality": readability, naming, structure, idiomatic use of the language (0-10)
- "efficiency": time/space complexity and any obvious inefficiencies (0-10)

Be honest — do not inflate either score just because tests passed; a passing but messy or inefficient solution should still score modestly on these two criteria.

Return ONLY a valid JSON object, no markdown formatting, no code fences, no extra text, in exactly this shape:
{
  "codeQuality": 7,
  "efficiency": 6,${narrationSchemaField}
  "feedback": "3-4 sentence assessment covering code quality, efficiency, and one concrete suggestion for improvement.${narrationFeedbackAsk} Do not state a specific overall numeric score in this text — a score is calculated separately from test results and these ratings."
}`;

    const completion = await groq.chat.completions.create({
      model: "openai/gpt-oss-120b",
      messages: [{ role: "user", content: prompt }],
      temperature: 0.3,
    });

    const rawText = completion.choices[0]?.message?.content || "";
    const cleaned = rawText.replace(/```json|```/g, "").trim();

    // "communication" is requested but never read: asking the model to commit
    // to a number first produces a far more grounded sentence than asking for
    // prose alone, and the score weights above stay untouched by design.
    let parsed: {
      codeQuality: number;
      efficiency: number;
      communication?: number;
      feedback: string;
    };
    try {
      parsed = JSON.parse(cleaned);
    } catch (parseErr) {
      console.error("Failed to parse coding score response:", rawText);
      return Response.json(
        { error: "Failed to parse AI scoring response." },
        { status: 500 }
      );
    }

    const finalScore = blendCodingScore(
      Number(testsPassed) || 0,
      Number(testsTotal) || 0,
      Number(parsed.codeQuality) || 0,
      Number(parsed.efficiency) || 0
    );

    const { error: sessionError } = await supabase.from("coding_sessions").insert({
      interview_id: interviewId || null,
      session_id: sessionId || null,
      coding_question_id: codingQuestionId || null,
      language,
      submitted_code: code,
      test_results: testResults,
      tests_passed: testsPassed,
      tests_total: testsTotal,
      ai_score: finalScore,
      ai_feedback: parsed.feedback,
    });

    if (sessionError) {
      console.error("Failed to save coding session:", sessionError);
      return Response.json(
        { error: "Failed to save coding session." },
        { status: 500 }
      );
    }

    return Response.json({ score: finalScore, feedback: parsed.feedback, testsPassed, testsTotal });
  } catch (err) {
    console.error("score-coding error:", err);
    return Response.json(
      { error: "Something went wrong scoring the code." },
      { status: 500 }
    );
  }
}
