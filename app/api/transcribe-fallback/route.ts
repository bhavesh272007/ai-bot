// app/api/transcribe-fallback/route.ts
import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  try {
    const incoming = await req.formData();
    const audio = incoming.get("audio");

    if (!audio || !(audio instanceof Blob)) {
      return NextResponse.json({ error: "No audio provided" }, { status: 400 });
    }

    const groqForm = new FormData();
    groqForm.append("file", audio, "recording.webm");
    groqForm.append("model", "whisper-large-v3-turbo");
    groqForm.append("language", "en");
    groqForm.append("response_format", "json");

    const groqRes = await fetch("https://api.groq.com/openai/v1/audio/transcriptions", {
      method: "POST",
      headers: { Authorization: `Bearer ${process.env.GROQ_API_KEY}` },
      body: groqForm,
    });

    if (!groqRes.ok) {
      const errText = await groqRes.text();
      console.error("[voice-fallback] Groq Whisper error:", errText);
      return NextResponse.json({ error: "Transcription failed" }, { status: 502 });
    }

    const data = await groqRes.json();
    console.log(`[voice-fallback] transcribed ${(audio.size / 1024).toFixed(1)}KB -> "${(data.text ?? "").slice(0, 60)}"`);
    return NextResponse.json({ text: data.text ?? "" });
  } catch (err) {
    console.error("[voice-fallback] server error:", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}