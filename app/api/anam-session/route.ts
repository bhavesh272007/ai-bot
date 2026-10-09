import { NextResponse } from "next/server";
import Groq from "groq-sdk";

export async function POST(req: Request) {
  try {
    const anamApiKey = process.env.ANAM_API_KEY || process.env.NEXT_PUBLIC_ANAM_API_KEY;
    if (!anamApiKey) {
      return NextResponse.json(
        {
          error:
            "ANAM_API_KEY is not set in .env.local. Please add your Anam API key to .env.local.",
        },
        { status: 500 }
      );
    }

    const body = await req.json().catch(() => ({}));
    const {
      candidateName = "Candidate",
      targetRole = "Software Engineer",
      targetLevel = "Mid to Senior Level",
      targetCompany = "Tech Company",
      resumeSummary = "",
      existingQuestions = [],
      interviewerName = "Sarah Miller",
    } = body;

    let questionsText = "";

    // 1. If questions are already provided, format them
    if (Array.isArray(existingQuestions) && existingQuestions.length > 0) {
      questionsText = existingQuestions
        .map((q: any, i: number) => `${i + 1}. [${q.category || "General"}] ${typeof q === "string" ? q : q.question}`)
        .join("\n");
    } else if (process.env.GROQ_API_KEY) {
      // 2. Generate questions dynamically using Groq (openai/gpt-oss-120b)
      try {
        const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
        const groqResponse = await groq.chat.completions.create({
          model: "openai/gpt-oss-120b",
          messages: [
            {
              role: "system",
              content:
                "You are an expert technical interviewer. Generate exactly 5 structured interview questions tailored to the role and candidate profile. Return ONLY a numbered list of questions, one per line.",
            },
            {
              role: "user",
              content: `Target Role: ${targetRole}, Level: ${targetLevel}, Company: ${targetCompany}. Candidate Background: ${resumeSummary || "Standard candidate background"}.`,
            },
          ],
          temperature: 0.7,
        });

        questionsText = groqResponse.choices[0]?.message?.content || "";
      } catch (groqErr) {
        console.warn("Groq generation fallback due to:", groqErr);
        questionsText = `1. Tell me about your technical background and your most impactful project.\n2. How do you approach designing scalable and maintainable systems?\n3. Describe a challenging technical bug or outage you resolved.\n4. How do you handle disagreements on technical architecture within a team?\n5. Do you have any questions for me about the role?`;
      }
    } else {
      questionsText = `1. Tell me about your background and recent projects.\n2. What are your core technical strengths in ${targetRole}?\n3. Describe a complex technical challenge you solved recently.\n4. How do you ensure high quality and reliability in your code?\n5. What questions do you have for me?`;
    }

    // 3. Resolve Persona ID (f6ac0513-54b5-4ccb-a33a-3d690938004c)
    let effectivePersonaId = process.env.ANAM_PERSONA_ID || "";

    if (!effectivePersonaId) {
      try {
        const personasRes = await fetch("https://api.anam.ai/v1/personas", {
          headers: { Authorization: `Bearer ${anamApiKey}` },
        });
        if (personasRes.ok) {
          const personasData = await personasRes.json();
          const personasList = Array.isArray(personasData)
            ? personasData
            : personasData.personas || personasData.data || [];
          if (personasList.length > 0) {
            const sarah = personasList.find((p: any) =>
              p.name?.toLowerCase()?.includes("sarah")
            );
            effectivePersonaId = sarah ? sarah.id : personasList[0].id;
          }
        }
      } catch (e) {
        console.warn("Could not list personas:", e);
      }
    }

    // 4. Request Stateful Session Token wrapped in personaConfig
    // Note: Wrapping { personaConfig: { personaId } } ensures Anam generates a 'stateful' token
    const tokenRequestBody = effectivePersonaId
      ? { personaConfig: { personaId: effectivePersonaId } }
      : {
          personaConfig: {
            name: interviewerName,
            avatarId: process.env.ANAM_AVATAR_ID || "30fa96d0-26c4-4e55-94a0-517025942e18",
            avatarModel: "cara-4",
            voiceId: process.env.ANAM_VOICE_ID || "6bfbe25a-979d-40f3-a92b-5394170af54b",
            systemPrompt: `You are ${interviewerName}, an expert interviewer. Ask these questions in sequence:\n${questionsText}`,
          },
        };

    const anamRes = await fetch("https://api.anam.ai/v1/auth/session-token", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${anamApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(tokenRequestBody),
    });

    if (!anamRes.ok) {
      const errText = await anamRes.text();
      console.error("Anam session token creation error:", errText);
      return NextResponse.json(
        { error: `Anam API Error (${anamRes.status}): ${errText}` },
        { status: anamRes.status }
      );
    }

    const anamData = await anamRes.json();
    return NextResponse.json({
      sessionToken: anamData.sessionToken,
      questions: questionsText,
      personaId: effectivePersonaId,
    });
  } catch (error: any) {
    console.error("Failed in /api/anam-session:", error);
    return NextResponse.json(
      { error: error?.message || "Internal Server Error" },
      { status: 500 }
    );
  }
}
