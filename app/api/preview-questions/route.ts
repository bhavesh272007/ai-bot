// TARGET PATH: app/api/preview-questions/route.ts
//
// Same generation logic as the original generate-questions route, but writes
// nothing to the database. Used by the new /create review-and-edit flow —
// the interview only gets persisted once the recruiter finalizes their edits
// via /api/finalize-interview.
import Groq from "groq-sdk";
import { NextRequest } from "next/server";
import { supabase } from "@/lib/supabase";

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

export async function POST(req: NextRequest) {
  try {
    const authHeader = req.headers.get("authorization") || "";
    const token = authHeader.replace("Bearer ", "");

    if (!token) {
      return Response.json({ error: "Not authenticated." }, { status: 401 });
    }

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser(token);

    if (authError || !user) {
      return Response.json({ error: "Not authenticated." }, { status: 401 });
    }

    const { jobDescription } = await req.json();

    if (!jobDescription || jobDescription.trim().length < 20) {
      return Response.json(
        { error: "Please provide a valid job description." },
        { status: 400 }
      );
    }

    const prompt = `You are helping create a technical interview for an engineering placement in India.

Given the job description below, generate 8-10 interview questions across these categories:
- "CS Fundamentals" (OS, DBMS, CN, OOPs concepts relevant to the role)
- "DSA" (1-2 data structures/algorithms problems appropriate to the role's level)
- "Project/Resume" (questions probing depth on projects mentioned or implied by the JD)
- "Behavioral" (STAR-method style questions relevant to a placement interview)

Job Description:
"""
${jobDescription}
"""

Return ONLY a valid JSON array, with no markdown formatting, no code fences, and no extra text. Each item must follow this exact shape:
[{"category": "CS Fundamentals", "question": "..."}]`;

    const completion = await groq.chat.completions.create({
      model: "openai/gpt-oss-120b",
      messages: [{ role: "user", content: prompt }],
      temperature: 0.7,
    });

    const rawText = completion.choices[0]?.message?.content || "";
    const cleaned = rawText.replace(/```json|```/g, "").trim();

    let questions;
    try {
      questions = JSON.parse(cleaned);
    } catch (parseErr) {
      console.error("Failed to parse Groq response:", rawText);
      return Response.json(
        { error: "Failed to parse AI response. Please try again." },
        { status: 500 }
      );
    }

    return Response.json({ questions });
  } catch (err) {
    console.error("preview-questions error:", err);
    return Response.json(
      { error: "Something went wrong generating questions." },
      { status: 500 }
    );
  }
}
