// TARGET PATH: app/api/interview/[id]/route.ts
import { NextRequest } from "next/server";
import { supabase } from "@/lib/supabase";
import { getLocalInterview } from "@/lib/local-interview-store";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  // 1. Check local in-memory/fallback store first
  const local = getLocalInterview(id);
  if (local) {
    return Response.json(local);
  }

  // 2. Query Supabase
  try {
    const { data: interview, error: interviewError } = await supabase
      .from("interviews")
      .select("*")
      .eq("id", id)
      .single();

    if (interviewError || !interview) {
      return Response.json({ error: "Interview not found." }, { status: 404 });
    }

    const { data: questions, error: questionsError } = await supabase
      .from("questions")
      .select("*")
      .eq("interview_id", id)
      .order("order_index", { ascending: true });

    if (questionsError) {
      return Response.json({ error: "Failed to load questions." }, { status: 500 });
    }

    return Response.json({
      interviewId: interview.id,
      isPractice: interview.is_practice || false,
      targetRole: interview.target_role || null,
      targetCompany: interview.target_company || null,
      targetLevel: interview.target_level || null,
      interviewerPersonality: interview.interviewer_personality || null,
      isPanelMode: interview.is_panel_mode || false,
      questions: questions.map((q) => ({
        category: q.category,
        question: q.question,
      })),
    });
  } catch (err) {
    console.error("Error querying Supabase interview:", err);
    return Response.json({ error: "Interview not found." }, { status: 404 });
  }
}