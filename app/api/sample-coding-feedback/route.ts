// TARGET PATH: app/api/sample-coding-feedback/route.ts
//
// Grades a submission from the public /sample-coding demo page.
//
// Two deliberate differences from /api/score-coding, which grades a real round:
//
//  1. Nothing is persisted. A demo submission has no interview, no session and
//     no candidate, so a row in `coding_sessions` would be an orphan that
//     pollutes every recruiter-facing aggregate that counts coding rounds.
//
//  2. It's rate limited per IP. This is an unauthenticated endpoint that spends
//     our Groq key on arbitrary user input — the same exposure /api/career-chat
//     has, so it uses the same guard.
//
// The score itself comes from the shared blendCodingScore in lib/scoring.ts, so
// a practice score means exactly what a real one does.
import Groq from "groq-sdk";
import { NextRequest, NextResponse } from "next/server";
import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";
import { blendCodingScore } from "@/lib/scoring";
import { getSampleProblem, type SampleLanguage } from "@/lib/sample-coding";

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
});

// Each call is a full Groq completion over user-supplied code, so this is
// tighter than the chat limit. Five is enough to try all three problems and
// iterate once, which is the whole point of the page.
const ratelimit = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(5, "60 s"),
  prefix: "ratelimit:sample-coding",
});

const SUPPORTED_LANGUAGES: SampleLanguage[] = ["javascript", "python", "java", "cpp"];

// Comfortably above any reasonable answer to these three problems, low enough
// that nobody can paste a novel in to burn tokens.
const CODE_CHAR_LIMIT = 10000;

interface TestResult {
  passed: boolean;
  input: string;
  expectedOutput: string;
  actualOutput: string;
}

export async function POST(req: NextRequest) {
  try {
    const ip =
      req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
      req.headers.get("x-real-ip") ??
      "unknown";

    const { success, remaining, reset } = await ratelimit.limit(ip);

    if (!success) {
      return NextResponse.json(
        {
          error:
            "You've submitted a few times in quick succession. Give it a minute and try again — or start a real practice interview, which isn't limited like this.",
        },
        {
          status: 429,
          headers: {
            "X-RateLimit-Remaining": String(remaining),
            "X-RateLimit-Reset": String(reset),
          },
        }
      );
    }

    const { problemId, language, code, testResults, testsPassed, testsTotal } =
      await req.json();

    // The problem text is looked up here rather than accepted from the client.
    // Trusting a posted `problemPrompt` would turn this into an open relay for
    // sending any text at all to Groq on our key.
    const problem = getSampleProblem(problemId);
    if (!problem) {
      return NextResponse.json({ error: "Unknown sample problem." }, { status: 400 });
    }

    if (!SUPPORTED_LANGUAGES.includes(language)) {
      return NextResponse.json({ error: "Unsupported language." }, { status: 400 });
    }

    if (typeof code !== "string" || !code.trim()) {
      return NextResponse.json({ error: "No code submitted." }, { status: 400 });
    }

    if (code.length > CODE_CHAR_LIMIT) {
      return NextResponse.json(
        { error: "That solution is too long to review. Trim it down and try again." },
        { status: 400 }
      );
    }

    const passed = Number(testsPassed) || 0;
    const total = Number(testsTotal) || 0;

    const testSummary = ((testResults || []) as TestResult[])
      .map(
        (r, i) =>
          `Test ${i + 1}: ${r.passed ? "PASSED" : "FAILED"}\nInput: ${r.input}\nExpected: ${r.expectedOutput}\nActual: ${r.actualOutput}`
      )
      .join("\n\n");

    const prompt = `You are an expert technical interviewer evaluating a candidate's coding round submission for an engineering placement interview in India.

Problem:
"""
${problem.prompt}
"""

Candidate's language: ${language}

Candidate's code:
"""
${code}
"""

Test results (${passed}/${total} passed):
${testSummary}

Test correctness is already measured objectively by the test results above — do not re-judge correctness. Instead, evaluate only:
- "codeQuality": readability, naming, structure, idiomatic use of the language (0-10)
- "efficiency": time/space complexity and any obvious inefficiencies (0-10)

Be honest — do not inflate either score just because tests passed; a passing but messy or inefficient solution should still score modestly on these two criteria.

This is a candidate's first look at the coding round, so keep the tone encouraging even when the scores are low, and make the suggestion something they can act on immediately.

Return ONLY a valid JSON object, no markdown formatting, no code fences, no extra text, in exactly this shape:
{
  "codeQuality": 7,
  "efficiency": 6,
  "feedback": "3-4 sentence assessment covering code quality, efficiency, and one concrete suggestion for improvement. Do not state a specific overall numeric score in this text — a score is calculated separately from test results and these ratings."
}`;

    const completion = await groq.chat.completions.create({
      model: "openai/gpt-oss-120b",
      messages: [{ role: "user", content: prompt }],
      temperature: 0.3,
    });

    const rawText = completion.choices[0]?.message?.content || "";
    const cleaned = rawText.replace(/```json|```/g, "").trim();

    let parsed: { codeQuality: number; efficiency: number; feedback: string };
    try {
      parsed = JSON.parse(cleaned);
    } catch {
      console.error("Failed to parse sample coding feedback response:", rawText);
      return NextResponse.json(
        { error: "Failed to parse AI feedback. Please try again." },
        { status: 500 }
      );
    }

    const score = blendCodingScore(
      passed,
      total,
      Number(parsed.codeQuality) || 0,
      Number(parsed.efficiency) || 0
    );

    return NextResponse.json({
      score,
      feedback: parsed.feedback,
      codeQuality: Number(parsed.codeQuality) || 0,
      efficiency: Number(parsed.efficiency) || 0,
      testsPassed: passed,
      testsTotal: total,
    });
  } catch (err) {
    console.error("sample-coding-feedback error:", err);
    return NextResponse.json(
      { error: "Something went wrong reviewing your code." },
      { status: 500 }
    );
  }
}
