import { NextRequest } from "next/server";
import { supabase } from "@/lib/supabase";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

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
    questions: questions.map((q) => ({
      category: q.category,
      question: q.question,
    })),
  });
}
