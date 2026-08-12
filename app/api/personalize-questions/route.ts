// TARGET PATH: app/api/personalize-questions/route.ts
//
// Public route — candidates never log in. Rewrites the interview's existing
// question set to reference the candidate's actual resume, WITHOUT touching
// the stored `questions` rows. The result is used only for that candidate's
// local session; the recruiter's original template is untouched, so every
// other candidate on the same link still gets the same baseline questions
// unless they also upload a resume.
import { NextRequest } from "next/server";
import Groq from "groq-sdk";
import { supabase } from "@/lib/supabase";

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

export async function POST(req: NextRequest) {
  try {
    const { interviewId, resumeText } = await req.json();

    if (!interviewId) {
      return Response.json({ error: "Missing interview id." }, { status: 400 });
    }
    if (!resumeText || !resumeText.trim()) {
      return Response.json({ error: "Missing resume text." }, { status: 400 });
    }

    const { data: originalQuestions, error: questionsError } = await supabase
      .from("questions")
      .select("category, question, order_index")
      .eq("interview_id", interviewId)
      .order("order_index", { ascending: true });

    if (questionsError || !originalQuestions || originalQuestions.length === 0) {
      return Response.json({ error: "Could not load this interview's questions." }, { status: 404 });
    }

    const originalList = originalQuestions
      .map((q, i) => `${i + 1}. [${q.category}] ${q.question}`)
      .join("\n");

    const prompt = `You are personalizing an already-finalized interview question set for one specific candidate, using their resume.

Original questions (fixed categories and order — do not add, remove, or reorder questions):
${originalList}

Candidate's resume excerpt:
"""
${resumeText.trim()}
"""

Rewrite each question to reference the candidate's actual projects, skills, or experience from their resume WHERE it naturally fits — especially for Experience/Project and Behavioral-style questions. For CS Fundamentals or DSA questions, you may adjust context/framing to their apparent skill level, but keep the underlying concept being tested the same. If a question has no natural resume connection, keep it close to the original rather than forcing an unnatural reference. Do not fabricate resume details that aren't there.

Return ONLY a valid JSON array with exactly ${originalQuestions.length} items, in the same order, no markdown formatting, no code fences, no extra text, in exactly this shape:
[{"category": "...", "question": "..."}]`;

    const completion = await groq.chat.completions.create({
      model: "llama-3.3-70b-versatile",
      messages: [{ role: "user", content: prompt }],
      temperature: 0.6,
    });

    const rawText = completion.choices[0]?.message?.content || "";
    const cleaned = rawText.replace(/```json|```/g, "").trim();

    let personalized: { category: string; question: string }[];
    try {
      personalized = JSON.parse(cleaned);
    } catch (parseErr) {
      console.error("Failed to parse personalize response:", rawText);
      return Response.json(
        { error: "Failed to personalize questions. You can continue with the original questions instead." },
        { status: 500 }
      );
    }

    // Defensive: if the AI returned a different count, fall back to the
    // original set rather than risk a mismatched/broken question list.
    if (!Array.isArray(personalized) || personalized.length !== originalQuestions.length) {
      console.error("Personalize response had unexpected shape/length:", personalized);
      return Response.json({
        questions: originalQuestions.map((q) => ({ category: q.category, question: q.question })),
        personalized: false,
      });
    }

    return Response.json({ questions: personalized, personalized: true });
  } catch (err) {
    console.error("personalize-questions error:", err);
    return Response.json(
      { error: "Something went wrong personalizing your questions." },
      { status: 500 }
    );
  }
}