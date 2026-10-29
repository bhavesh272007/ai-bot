// TARGET PATH: app/api/generate-practice-questions/route.ts
import Groq from "groq-sdk";
import { NextRequest } from "next/server";
import { supabase } from "@/lib/supabase";
import { getInterviewType } from "@/lib/interview-types";
import { getInterviewerPersonality } from "@/lib/interviewer-personalities";
import { saveLocalInterview } from "@/lib/local-interview-store";

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

export async function POST(req: NextRequest) {
  try {
    const { role, company, level, interviewType, resumeText, interviewerPersonality, panelMode } = await req.json();

    if (!role || !role.trim()) {
      return Response.json({ error: "Please enter a target role." }, { status: 400 });
    }

    const levelLabel = level || "Entry-level";
    const typeDef = getInterviewType(interviewType);
    // Silently falls back to null rather than erroring on an unrecognized
    // id — question generation itself doesn't depend on personality, only
    // the later follow-up/scoring calls do.
    const personalityDef = getInterviewerPersonality(interviewerPersonality);

    const balancedMix =
      "A balanced mix: 2-3 CS Fundamentals, 1-2 DSA, 2 Experience, and 2 Behavioral questions.";

    // Panel mode needs BOTH interviewer roles to actually get questions —
    // technical (CS Fundamentals/DSA) and behavioral (Experience/Behavioral).
    // An interview-type focus like "Behavioral" would otherwise starve the
    // technical interviewer entirely (near-zero CS Fundamentals/DSA
    // questions generated), leaving that avatar dimmed the whole session.
    // Panel mode's category mix intentionally overrides the interview type
    // selection for this reason — the type is still used for its title/
    // framing, just not its category weighting, while panel mode is on.
    const questionMix = panelMode ? balancedMix : typeDef?.promptFocus || balancedMix;

    // Resume text (if provided) is used only for this single generation call
    // — it is never written to the database, here or anywhere downstream.
    const resumeSection =
      resumeText && resumeText.trim()
        ? `\nThe candidate has also provided their resume below. Ground questions in their ACTUAL projects, skills, and experience wherever relevant — especially "Experience" and "Behavioral" questions, but also let it inform which specific technologies/concepts "CS Fundamentals" and "DSA" questions probe. Don't fabricate anything not implied by the resume, and don't force a resume reference into every single question if it doesn't naturally fit.

Resume excerpt:
"""
${resumeText.trim()}
"""
`
        : "";

    const prompt = `You are helping a student prepare for an engineering placement interview in India through self-directed practice — there is no specific job posting, only the details below.

Target role: ${role}
Target company: ${company && company.trim() ? company : "Not specified — keep it broadly applicable"}
Experience level: ${levelLabel}
${typeDef ? `Practice focus: ${typeDef.title}` : ""}
${resumeSection}
The four possible question categories are:
- "CS Fundamentals" (OS, DBMS, CN, OOPs concepts relevant to the role)
- "DSA" (data structures/algorithms problems appropriate to the role and level)
- "Experience" (general questions about past projects, coursework, or work relevant to the role${
      resumeText ? " — reference their actual resume where possible" : ", phrased generically since there's no resume on file"
    })
- "Behavioral" (STAR-method or HR/situational style questions relevant to a placement interview)

Question mix for this session (this is the most important instruction — follow it precisely):
${questionMix}

Calibrate difficulty to the stated experience level (lighter DSA for Internship, standard for Entry-level, harder/more advanced for Experienced).

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

    const summary = `Self-practice: ${role}${
      company && company.trim() ? ` @ ${company}` : ""
    } (${levelLabel})${typeDef ? ` · ${typeDef.title}` : ""}${resumeText ? " · resume-personalized" : ""}${
      personalityDef ? ` · ${personalityDef.title} interviewer` : ""
    }${panelMode ? " · panel mode" : ""}`;

    let interviewId: string | null = null;

    try {
      const { data: interview, error: interviewError } = await supabase
        .from("interviews")
        .insert({
          job_description: summary,
          recruiter_id: null,
          is_practice: true,
          target_role: role,
          target_company: company && company.trim() ? company : null,
          target_level: levelLabel,
          interviewer_personality: personalityDef?.id || null,
          is_panel_mode: !!panelMode,
        })
        .select()
        .single();

      if (!interviewError && interview) {
        interviewId = interview.id;

        const questionRows = questions.map(
          (q: { category: string; question: string }, i: number) => ({
            interview_id: interview.id,
            category: q.category,
            question: q.question,
            order_index: i,
          })
        );

        const { error: questionsError } = await supabase
          .from("questions")
          .insert(questionRows);

        if (questionsError) {
          console.warn("Supabase questions insert error, will use local fallback:", questionsError);
          interviewId = null;
        }
      } else {
        console.warn("Supabase interview insert error (likely paused project or offline), using local fallback:", interviewError);
      }
    } catch (dbErr) {
      console.warn("Supabase connection exception, using local fallback:", dbErr);
    }

    // If Supabase was unavailable or errored, save to local fallback store so interview proceeds seamlessly
    if (!interviewId) {
      const fallbackId = `practice-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
      saveLocalInterview({
        interviewId: fallbackId,
        isPractice: true,
        targetRole: role,
        targetCompany: company && company.trim() ? company : null,
        targetLevel: levelLabel,
        interviewerPersonality: personalityDef?.id || null,
        isPanelMode: !!panelMode,
        questions: questions.map((q: any) => ({
          category: q.category,
          question: q.question,
        })),
        createdAt: Date.now(),
      });
      interviewId = fallbackId;
    }

    return Response.json({ interviewId });
  } catch (err) {
    console.error("generate-practice-questions error:", err);
    return Response.json(
      { error: "Something went wrong generating your practice interview." },
      { status: 500 }
    );
  }
}