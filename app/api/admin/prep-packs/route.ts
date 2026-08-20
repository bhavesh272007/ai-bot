// TARGET PATH: app/api/admin/prep-packs/route.ts
import { NextRequest } from "next/server";
import { supabase, supabaseAsUser } from "@/lib/supabase";
import { COMPANIES } from "@/lib/companies";

export async function GET(req: NextRequest) {
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

    const { data: packs, error: packsError } = await db
      .from("prep_packs")
      .select("company_id, questions, is_curated, generated_at");

    if (packsError) {
      console.error("Failed to load prep packs for admin:", packsError);
      return Response.json({ error: "Failed to load prep packs." }, { status: 500 });
    }

    const packById = new Map((packs || []).map((p) => [p.company_id, p]));

    const list = COMPANIES.map((c) => {
      const pack = packById.get(c.id);
      return {
        companyId: c.id,
        companyLabel: c.label,
        isCurated: pack?.is_curated ?? false,
        hasAnyPack: !!pack,
        questionCount: Array.isArray(pack?.questions) ? pack.questions.length : 0,
        generatedAt: pack?.generated_at ?? null,
      };
    });

    return Response.json({ companies: list });
  } catch (err) {
    console.error("admin prep-packs list error:", err);
    return Response.json({ error: "Something went wrong." }, { status: 500 });
  }
}