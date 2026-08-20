// TARGET PATH: app/api/admin/prep-pack/[company]/route.ts
import { NextRequest } from "next/server";
import { supabase, supabaseAsUser } from "@/lib/supabase";
import { COMPANIES } from "@/lib/companies";

async function requireRecruiter(req: NextRequest) {
  const authHeader = req.headers.get("authorization") || "";
  const token = authHeader.replace("Bearer ", "");

  if (!token) {
    return { error: Response.json({ error: "Not authenticated." }, { status: 401 }) };
  }

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser(token);

  if (authError || !user) {
    return { error: Response.json({ error: "Not authenticated." }, { status: 401 }) };
  }

  return { token };
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ company: string }> }
) {
  const { company: companyId } = await params;
  const companyDef = COMPANIES.find((c) => c.id === companyId);
  if (!companyDef) {
    return Response.json({ error: "Unknown company." }, { status: 404 });
  }

  const auth = await requireRecruiter(req);
  if (auth.error) return auth.error;

  const db = supabaseAsUser(auth.token!);

  const { data: pack, error } = await db
    .from("prep_packs")
    .select("*")
    .eq("company_id", companyId)
    .maybeSingle();

  if (error) {
    console.error("Failed to load prep pack for admin edit:", error);
    return Response.json({ error: "Failed to load prep pack." }, { status: 500 });
  }

  return Response.json({
    companyId,
    companyLabel: companyDef.label,
    questions: pack?.questions || [],
    isCurated: pack?.is_curated ?? false,
  });
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ company: string }> }
) {
  const { company: companyId } = await params;
  const companyDef = COMPANIES.find((c) => c.id === companyId);
  if (!companyDef) {
    return Response.json({ error: "Unknown company." }, { status: 404 });
  }

  const auth = await requireRecruiter(req);
  if (auth.error) return auth.error;

  try {
    const { questions } = await req.json();

    if (
      !Array.isArray(questions) ||
      questions.length === 0 ||
      !questions.every(
        (q) => q && typeof q.category === "string" && typeof q.question === "string" && q.question.trim()
      )
    ) {
      return Response.json({ error: "Provide at least one valid question." }, { status: 400 });
    }

    const cleanedQuestions = questions.map((q: { category: string; question: string }) => ({
      category: q.category,
      question: q.question.trim(),
    }));

    const db = supabaseAsUser(auth.token!);

    // Upsert on company_id — overwrites any AI-generated pack that was
    // previously cached for this company, and marks it curated so the
    // public route never regenerates over it again.
    const { data: upserted, error: upsertError } = await db
      .from("prep_packs")
      .upsert(
        {
          company_id: companyId,
          company_label: companyDef.label,
          questions: cleanedQuestions,
          is_curated: true,
          generated_at: new Date().toISOString(),
        },
        { onConflict: "company_id" }
      )
      .select()
      .single();

    if (upsertError) {
      console.error("Failed to save curated prep pack:", upsertError);
      return Response.json({ error: "Failed to save prep pack." }, { status: 500 });
    }

    return Response.json({
      companyId: upserted.company_id,
      companyLabel: upserted.company_label,
      questions: upserted.questions,
      isCurated: upserted.is_curated,
    });
  } catch (err) {
    console.error("admin prep-pack save error:", err);
    return Response.json({ error: "Something went wrong saving." }, { status: 500 });
  }
}