// app/test-voice/page.tsx
"use client";

import { MicCheckCard } from "@/components/voice/MicCheckCard";

export default function TestVoicePage() {
  return (
    <div className="flex min-h-screen items-center justify-center p-8" style={{ background: "var(--background)" }}>
      <MicCheckCard onVerified={() => console.log("[test-voice] verified!")} />
    </div>
  );
}
