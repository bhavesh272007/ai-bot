// TARGET PATH: app/api/generate-followup/route.ts
import Groq from "groq-sdk";
import { NextRequest } from "next/server";
import { getInterviewerPersonality } from "@/lib/interviewer-personalities";

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

export async function POST(req: NextRequest) {
  try {
    const { category, question, answer, interviewerPersonality } = await req.json();

    if (!question || !answer) {
      return Response.json({ followUp: null });
    }

    // Don't bother probing empty/skipped answers
    const trimmed = String(answer).trim();
    if (trimmed.length < 15 || trimmed === "(no answer given)") {
      return Response.json({ followUp: null });
    }

    const personalityDef = getInterviewerPersonality(interviewerPersonality);
    // Neutral default tone when no personality is set — e.g. recruiter-shared
    // interviews, which don't currently expose this picker to the candidate.
    const toneDirective =
      personalityDef?.toneDirective ||
      "You are an interviewer conducting a live technical placement interview.";

    const prompt = `${toneDirective}

You just asked this ${category} question:
"${question}"

The candidate answered:
"${trimmed}"

Decide if ONE natural follow-up question would meaningfully probe deeper — e.g. the answer was vague, mentioned something worth digging into, made a claim worth verifying, or left an obvious thread unexplored. If the answer was already thorough and specific, don't force a follow-up just for the sake of it.

Return ONLY valid JSON, no markdown formatting, no code fences, no extra text, in exactly this shape:
{"needsFollowUp": true, "followUpQuestion": "..."}
or
{"needsFollowUp": false, "followUpQuestion": null}`;

    const completion = await groq.chat.completions.create({
      model: "openai/gpt-oss-120b",
      messages: [{ role: "user", content: prompt }],
      temperature: 0.5,
    });

    const rawText = completion.choices[0]?.message?.content || "";
    const cleaned = rawText.replace(/```json|```/g, "").trim();

    let result: { needsFollowUp?: boolean; followUpQuestion?: string | null };
    try {
      result = JSON.parse(cleaned);
    } catch (parseErr) {
      console.error("Failed to parse follow-up response:", rawText);
      return Response.json({ followUp: null });
    }

    if (result.needsFollowUp && result.followUpQuestion) {
      return Response.json({ followUp: result.followUpQuestion });
    }

    return Response.json({ followUp: null });
  } catch (err) {
    console.error("generate-followup error:", err);
    // Fail safe — never let a broken follow-up call block the interview
    return Response.json({ followUp: null });
  }
}