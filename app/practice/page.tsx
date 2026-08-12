// TARGET PATH: app/practice/page.tsx
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { InterviewTypeCards } from "@/components/interview-type-cards";
import { ResumeUpload } from "@/components/resume-upload";
import { getInterviewType } from "@/lib/interview-types";

const LEVELS = ["Internship", "Entry-level", "Experienced"] as const;

export default function Practice() {
  const router = useRouter();

  const [interviewType, setInterviewType] = useState<string | null>(null);
  const [role, setRole] = useState("");
  const [company, setCompany] = useState("");
  const [level, setLevel] = useState<(typeof LEVELS)[number]>("Entry-level");
  const [resumeText, setResumeText] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const canStart = !loading && role.trim().length >= 2 && !!interviewType;

  async function handleStart() {
    if (!interviewType) {
      setError("Pick an interview type above to continue.");
      return;
    }

    setLoading(true);
    setError("");

    try {
      const res = await fetch("/api/generate-practice-questions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role, company, level, interviewType, resumeText }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Something went wrong.");
        setLoading(false);
        return;
      }

      router.push(`/interview/${data.interviewId}`);
    } catch (err) {
      setError("Failed to reach the server. Please try again.");
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen bg-background flex items-center justify-center px-4 py-12">
      <Card className="max-w-2xl w-full overflow-hidden pt-0">
        <div className="flex gap-1.5 px-6 pt-4 pb-2">
          {Array.from({ length: 10 }).map((_, i) => (
            <div
              key={i}
              className="w-1.5 h-1.5 rounded-full bg-background border border-border"
            />
          ))}
        </div>

        <CardHeader>
          <p className="label-mono mb-1">Self practice · no login needed</p>
          <CardTitle>Build your own mock interview</CardTitle>
        </CardHeader>

        <CardContent className="space-y-6">
          <p className="text-sm text-muted-foreground">
            Tell us what you're preparing for. We'll generate a full practice
            interview — question round, live coding, and voice practice — scored
            just like the real thing. Nothing here is tracked by any recruiter.
          </p>

          <div className="space-y-2">
            <label className="label-mono">Choose interview type</label>
            <InterviewTypeCards
              interactive
              selectedId={interviewType}
              onSelect={setInterviewType}
            />
          </div>

          <div className="space-y-2">
            <label className="label-mono">Target role</label>
            <input
              value={role}
              onChange={(e) => setRole(e.target.value)}
              placeholder="e.g. Software Engineer, Data Analyst"
              className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground"
            />
          </div>

          <div className="space-y-2">
            <label className="label-mono">Target company (optional)</label>
            <input
              value={company}
              onChange={(e) => setCompany(e.target.value)}
              placeholder="e.g. TCS, Infosys, or leave blank"
              className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground"
            />
          </div>

          <div className="space-y-2">
            <label className="label-mono">Experience level</label>
            <div className="grid grid-cols-3 gap-2">
              {LEVELS.map((l) => (
                <button
                  key={l}
                  type="button"
                  onClick={() => setLevel(l)}
                  className={`rounded-md border px-3 py-2 text-sm transition-colors ${
                    level === l
                      ? "border-foreground bg-foreground text-background"
                      : "border-border bg-background text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {l}
                </button>
              ))}
            </div>
          </div>

          <ResumeUpload
            onExtracted={(text) => setResumeText(text)}
            onClear={() => setResumeText(null)}
          />

          <Button onClick={handleStart} disabled={!canStart} className="w-full">
            {loading ? "Building your interview..." : "Start Practice Interview"}
          </Button>

          {!interviewType && !error && (
            <p className="text-sm text-muted-foreground/70 text-center">
              Pick an interview type above to enable this button.
            </p>
          )}

          {error && <p className="text-sm text-destructive text-center">{error}</p>}

          <p className="text-sm text-muted-foreground/70 text-center">
            <a href="/" className="hover:underline">
              ← Back to home
            </a>
          </p>
        </CardContent>
      </Card>
    </main>
  );
}