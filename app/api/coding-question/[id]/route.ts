// TARGET PATH: app/api/coding-question/[id]/route.ts
import Groq from "groq-sdk";
import { NextRequest } from "next/server";
import { supabase } from "@/lib/supabase";

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: interviewId } = await params;

  try {
    // Reuse the coding question if one was already generated for this interview
    const { data: existing, error: existingError } = await supabase
      .from("coding_questions")
      .select("*")
      .eq("interview_id", interviewId)
      .maybeSingle();

    if (existingError) {
      console.error("Failed to check existing coding question:", existingError);
      return Response.json(
        { error: "Failed to load coding question." },
        { status: 500 }
      );
    }

    if (existing) {
      return Response.json({ codingQuestion: existing });
    }

    const { data: interview, error: interviewError } = await supabase
      .from("interviews")
      .select("*")
      .eq("id", interviewId)
      .single();

    if (interviewError || !interview) {
      return Response.json({ error: "Interview not found." }, { status: 404 });
    }

    const prompt = `You are creating ONE coding round problem for an engineering placement interview in India, based on the job description below.

Job Description:
"""
${interview.job_description}
"""

Design a single, moderate-difficulty DSA/coding problem (array, string, hashmap, two pointers, recursion, or similar — appropriate to the JD's level, avoid graphs/advanced DP unless the JD is clearly senior/advanced).

The problem MUST be solvable using simple stdin/stdout:
- Input is provided via standard input (stdin), following a format YOU define and explain clearly in the problem statement (e.g. "first line: integer n; second line: n space-separated integers").
- The program must print ONLY the final answer to standard output (stdout), with no extra text or labels.

Provide exactly 3 test cases. Keep expected outputs exact strings with no trailing explanation.

Provide starter code (boilerplate that reads stdin in the correct format and has a clearly marked spot for the candidate's solution, WITHOUT solving the problem) for these 4 languages:
- javascript: Node.js, read stdin via require('fs').readFileSync(0,'utf8')
- python: Python 3, read stdin via sys.stdin or input()
- java: Java, the public class MUST be named "Main", read stdin via Scanner or BufferedReader
- cpp: C++17, read stdin via cin

Return ONLY a valid JSON object, no markdown formatting, no code fences, no extra text, in exactly this shape:
{
  "title": "Short problem title",
  "prompt": "Full problem statement including input/output format, constraints, and one worked example.",
  "testCases": [
    { "input": "stdin text for test 1", "expectedOutput": "expected stdout for test 1" },
    { "input": "stdin text for test 2", "expectedOutput": "expected stdout for test 2" },
    { "input": "stdin text for test 3", "expectedOutput": "expected stdout for test 3" }
  ],
  "starterCode": {
    "javascript": "...",
    "python": "...",
    "java": "...",
    "cpp": "..."
  }
}`;

    const completion = await groq.chat.completions.create({
      model: "openai/gpt-oss-120b",
      messages: [{ role: "user", content: prompt }],
      temperature: 0.6,
      response_format: { type: "json_object" },
    });

    const rawText = completion.choices[0]?.message?.content || "";

    // Strip markdown fences if present, then fall back to extracting the outermost {...} block
    // in case the model added any stray text before/after the JSON despite response_format.
    let cleaned = rawText.replace(/```json|```/g, "").trim();
    const firstBrace = cleaned.indexOf("{");
    const lastBrace = cleaned.lastIndexOf("}");
    if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
      cleaned = cleaned.slice(firstBrace, lastBrace + 1);
    }

    let generated;
    try {
      generated = JSON.parse(cleaned);
    } catch (parseErr) {
      console.error("Failed to parse coding question response. Raw output:", rawText);
      return Response.json(
        { error: "Failed to parse AI response. Please try again." },
        { status: 500 }
      );
    }

    // Basic shape validation so a malformed-but-parseable response doesn't silently corrupt the DB row
    if (
      !generated?.title ||
      !generated?.prompt ||
      !Array.isArray(generated?.testCases) ||
      !generated?.starterCode
    ) {
      console.error("Coding question response missing required fields:", generated);
      return Response.json(
        { error: "AI response was incomplete. Please try again." },
        { status: 500 }
      );
    }

    const { data: inserted, error: insertError } = await supabase
      .from("coding_questions")
      .insert({
        interview_id: interviewId,
        title: generated.title,
        prompt: generated.prompt,
        starter_code: generated.starterCode,
        test_cases: generated.testCases,
      })
      .select()
      .single();

    if (insertError) {
      console.error("Failed to save coding question:", insertError);
      return Response.json(
        { error: "Failed to save coding question." },
        { status: 500 }
      );
    }

    return Response.json({ codingQuestion: inserted });
  } catch (err) {
    console.error("coding-question error:", err);
    return Response.json(
      { error: "Something went wrong generating the coding question." },
      { status: 500 }
    );
  }
}