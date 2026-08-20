// TARGET PATH: app/api/prep-pack/[company]/route.ts
import Groq from "groq-sdk";
import { NextRequest } from "next/server";
import { supabase } from "@/lib/supabase";
import { COMPANIES } from "@/lib/companies";

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ company: string }> }
) {
  const { company: companyId } = await params;

  // Validate against the fixed curated list — this is what keeps prep_packs
  // bounded to ~12 known rows rather than an open-ended set of AI-generated
  // rows for arbitrary user-supplied company names.
  const companyDef = COMPANIES.find((c) => c.id === companyId);
  if (!companyDef) {
    return Response.json({ error: "Unknown company." }, { status: 404 });
  }

  try {
    const { data: existing, error: existingError } = await supabase
      .from("prep_packs")
      .select("*")
      .eq("company_id", companyId)
      .maybeSingle();

    if (existingError) {
      console.error("Failed to check existing prep pack:", existingError);
      return Response.json({ error: "Failed to load prep pack." }, { status: 500 });
    }

    if (existing) {
      return Response.json({
        companyId: existing.company_id,
        companyLabel: existing.company_label,
        questions: existing.questions,
        generatedAt: existing.generated_at,
        isCurated: existing.is_curated,
      });
    }

    const prompt = `You are building a curated practice question set for students preparing for an engineering placement interview at ${companyDef.label} in India.

Common interview pattern at this company: ${companyDef.description}

Generate 8 realistic practice questions that reflect ${companyDef.label}'s typical placement interview style, spread across these categories:
- "CS Fundamentals" (OS, DBMS, CN, OOPs)
- "DSA" (data structures/algorithms, calibrated to this company's typical bar)
- "Experience" (projects, coursework)
- "Behavioral" (STAR-method/HR/situational)

Weight the mix toward what this company's rounds are actually known for (e.g. more DSA depth for a product company, more fundamentals/aptitude for a mass-hire IT services company). Do not fabricate specific proprietary questions or claim these are leaked/real questions — these are illustrative practice questions in the company's typical style, and should read that way.

Return ONLY a valid JSON object, no markdown formatting, no code fences, no extra text, in exactly this shape:
{"questions": [{"category": "CS Fundamentals", "question": "..."}]}`;

    const completion = await groq.chat.completions.create({
      model: "openai/gpt-oss-120b",
      messages: [{ role: "user", content: prompt }],
      temperature: 0.7,
      response_format: { type: "json_object" },
    });

    const rawText = completion.choices[0]?.message?.content || "";
    let cleaned = rawText.replace(/```json|```/g, "").trim();
    const firstBrace = cleaned.indexOf("{");
    const lastBrace = cleaned.lastIndexOf("}");
    if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
      cleaned = cleaned.slice(firstBrace, lastBrace + 1);
    }

    let generated: { questions?: { category: string; question: string }[] };
    try {
      generated = JSON.parse(cleaned);
    } catch (parseErr) {
      console.error("Failed to parse prep pack response. Raw output:", rawText);
      return Response.json({ error: "Failed to generate prep pack." }, { status: 500 });
    }

    if (!Array.isArray(generated?.questions) || generated.questions.length === 0) {
      console.error("Prep pack response missing questions:", generated);
      return Response.json({ error: "Prep pack came back incomplete." }, { status: 500 });
    }

    // If two requests race to generate the same company's pack, the unique
    // constraint on company_id rejects the second insert — fall through and
    // re-fetch the row the other request created, same pattern as
    // weekly-challenge's race handling.
    const { data: inserted, error: insertError } = await supabase
      .from("prep_packs")
      .insert({
        company_id: companyId,
        company_label: companyDef.label,
        questions: generated.questions,
      })
      .select()
      .maybeSingle();

    let finalPack = inserted;
    if (insertError || !inserted) {
      const { data: refetched } = await supabase
        .from("prep_packs")
        .select("*")
        .eq("company_id", companyId)
        .maybeSingle();

      if (!refetched) {
        console.error("Failed to save prep pack:", insertError);
        return Response.json({ error: "Failed to save prep pack." }, { status: 500 });
      }
      finalPack = refetched;
    }

    return Response.json({
      companyId: finalPack.company_id,
      companyLabel: finalPack.company_label,
      questions: finalPack.questions,
      generatedAt: finalPack.generated_at,
      isCurated: finalPack.is_curated,
    });
  } catch (err) {
    console.error("prep-pack error:", err);
    return Response.json({ error: "Something went wrong generating the prep pack." }, { status: 500 });
  }
}