// TARGET PATH: app/api/finalize-interview/route.ts
import { NextRequest } from "next/server";
import { supabase, supabaseAsUser } from "@/lib/supabase";

interface FinalQuestion {
  category: string;
  question: string;
}

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

    const db = supabaseAsUser(token);

    const { jobDescription, questions } = await req.json();

    if (!jobDescription || jobDescription.trim().length < 20) {
      return Response.json(
        { error: "Please provide a valid job description." },
        { status: 400 }
      );
    }

    if (!Array.isArray(questions) || questions.length === 0) {
      return Response.json(
        { error: "Add at least one question before creating the interview." },
        { status: 400 }
      );
    }

    for (const q of questions as FinalQuestion[]) {
      if (!q.category || !q.question || !q.question.trim()) {
        return Response.json(
          { error: "Every question needs a category and question text." },
          { status: 400 }
        );
      }
    }

    const { data: interview, error: interviewError } = await db
      .from("interviews")
      .insert({ job_description: jobDescription, recruiter_id: user.id })
      .select()
      .single();

    if (interviewError) {
      console.error("Failed to save interview:", interviewError);
      return Response.json(
        { error: "Failed to save interview to database." },
        { status: 500 }
      );
    }

    const questionRows = (questions as FinalQuestion[]).map((q, i) => ({
      interview_id: interview.id,
      category: q.category,
      question: q.question.trim(),
      order_index: i,
    }));

    const { error: questionsError } = await db
      .from("questions")
      .insert(questionRows);

    if (questionsError) {
      console.error("Failed to save questions:", questionsError);
      return Response.json(
        { error: "Failed to save questions to database." },
        { status: 500 }
      );
    }

    return Response.json({ interviewId: interview.id });
  } catch (err) {
    console.error("finalize-interview error:", err);
    return Response.json(
      { error: "Something went wrong creating the interview." },
      { status: 500 }
    );
  }
}