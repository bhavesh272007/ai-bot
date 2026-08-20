// TARGET PATH: app/api/swap-question/route.ts
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

    const { jobDescription, category, existingQuestions } = await req.json();

    if (!jobDescription || !category) {
      return Response.json(
        { error: "Missing job description or category." },
        { status: 400 }
      );
    }

    const avoidList = (Array.isArray(existingQuestions) ? existingQuestions : [])
      .map((q: string, i: number) => `${i + 1}. ${q}`)
      .join("\n");

    const prompt = `You are helping refine a technical interview for an engineering placement in India.

Job Description:
"""
${jobDescription}
"""

Generate ONE new interview question in the "${category}" category, appropriate for this job description and role level.

Do not repeat or closely resemble any of these existing questions in the interview:
${avoidList || "(none yet)"}

Return ONLY a valid JSON object, no markdown formatting, no code fences, no extra text, in exactly this shape:
{"question": "..."}`;

    const completion = await groq.chat.completions.create({
      model: "openai/gpt-oss-120b",
      messages: [{ role: "user", content: prompt }],
      temperature: 0.8,
    });

    const rawText = completion.choices[0]?.message?.content || "";
    const cleaned = rawText.replace(/```json|```/g, "").trim();

    let parsed: { question?: string };
    try {
      parsed = JSON.parse(cleaned);
    } catch (parseErr) {
      console.error("Failed to parse swap response:", rawText);
      return Response.json(
        { error: "Failed to parse AI response. Please try again." },
        { status: 500 }
      );
    }

    if (!parsed.question) {
      return Response.json(
        { error: "AI did not return a replacement question." },
        { status: 500 }
      );
    }

    return Response.json({ question: parsed.question });
  } catch (err) {
    console.error("swap-question error:", err);
    return Response.json(
      { error: "Something went wrong swapping the question." },
      { status: 500 }
    );
  }
}
