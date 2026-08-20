// TARGET PATH: app/practice/page.tsx
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { InterviewTypeCards } from "@/components/interview-type-cards";
import { DomainCards, type Domain } from "@/components/domain-cards";
import { ResumeUpload } from "@/components/resume-upload";
import { getInterviewType } from "@/lib/interview-types";
import { INTERVIEWER_PERSONALITIES } from "@/lib/interviewer-personalities";

const LEVELS = ["Internship", "Entry-level", "Experienced"] as const;

export default function Practice() {
  const router = useRouter();

  const [interviewType, setInterviewType] = useState<string | null>(null);
  const [selectedDomainId, setSelectedDomainId] = useState<string | null>(null);
  const [role, setRole] = useState("");
  const [company, setCompany] = useState("");
  const [level, setLevel] = useState<(typeof LEVELS)[number]>("Entry-level");
  // Defaults to Friendly HR — same "sensible default, no forced choice" pattern
  // as Experience Level above. Candidate can change it before starting.
  const [interviewerPersonality, setInterviewerPersonality] = useState<string>("friendly_hr");
  // Opt-in only — off by default. Two AI interviewers (technical +
  // behavioral) alternate questions instead of one. Practice mode only.
  const [panelMode, setPanelMode] = useState(false);
  const [resumeText, setResumeText] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const canStart = !loading && role.trim().length >= 2 && !!interviewType;

  function handleDomainSelect(domain: Domain) {
    setSelectedDomainId(domain.id);
    // Quick-fill only — the existing role input is what actually reaches
    // generate-practice-questions, so this can't silently do nothing if
    // that route doesn't separately handle a "domain" field. User can still
    // edit the role text after picking a domain.
    setRole(domain.label);
  }

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
        body: JSON.stringify({
          role,
          company,
          level,
          interviewType,
          resumeText,
          interviewerPersonality,
          panelMode,
        }),
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
      <Card className="max-w-4xl w-full overflow-hidden pt-0">
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
            <label className="label-mono">Choose your domain</label>
            <p className="text-sm text-muted-foreground/70">
              Picks a starting point for your target role below — feel free to edit it after.
            </p>
            <DomainCards
              mode="select"
              selectedId={selectedDomainId}
              onSelect={handleDomainSelect}
            />
          </div>

          <div className="grid sm:grid-cols-2 gap-6">
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

          <div className="space-y-2">
            <label className="label-mono">Interviewer personality</label>
            <p className="text-sm text-muted-foreground/70">
              Shapes the tone of follow-up questions and how strictly your answers are scored.
            </p>
            <div className="grid sm:grid-cols-3 gap-2">
              {INTERVIEWER_PERSONALITIES.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => setInterviewerPersonality(p.id)}
                  className={`text-left rounded-md border px-3 py-2 transition-colors ${
                    interviewerPersonality === p.id
                      ? "border-foreground bg-foreground text-background"
                      : "border-border bg-background text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <p className="text-sm font-medium">{p.title}</p>
                  <p
                    className={`text-xs mt-0.5 ${
                      interviewerPersonality === p.id ? "text-background/70" : "text-muted-foreground/70"
                    }`}
                  >
                    {p.description}
                  </p>
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={panelMode}
                onChange={(e) => setPanelMode(e.target.checked)}
                className="h-4 w-4 accent-foreground"
              />
              <span className="label-mono">Panel interview (2 interviewers)</span>
            </label>
            <p className="text-sm text-muted-foreground/70 pl-6">
              A technical and a behavioral interviewer alternate questions in the same session,
              instead of one interviewer asking everything.
              {panelMode && (
                <span className="block mt-1">
                  Note: the question mix will be balanced across categories while this is on, so
                  both interviewers get a turn — your Interview Type selection above won't skew it.
                </span>
              )}
            </p>
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