// TARGET PATH: app/challenge/page.tsx
"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Loader2, AlertCircle, ArrowLeft, ArrowRight } from "lucide-react";
import { toDisplayScore } from "@/lib/scoring";

interface Stats {
  average_score: number;
  attempt_count: number;
}

interface MyAttempt {
  score: number;
  answer_text: string;
  strengths: string | null;
  improvements: string | null;
  submitted_at: string;
}

function isValidEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

const PAGE_GRADIENT =
  "radial-gradient(circle at 50% 0%, #f2ff6b 0%, #d4f24f 10%, transparent 32%), linear-gradient(180deg, #c6f24a 0%, #a3ec5c 8%, #7fe3a0 16%, #6fe0c0 24%, #7fe8dd 32%, #cdf3ec 42%, #ffffff 56%)";

const STEP_ORDER = ["email", "answer", "result"] as const;
type UiStep = (typeof STEP_ORDER)[number];
const STEP_LABELS: Record<UiStep, string> = {
  email: "Enter Email",
  answer: "Answer Question",
  result: "See Your Score",
};

function StepIndicator({ step }: { step: UiStep }) {
  const currentIndex = STEP_ORDER.indexOf(step);
  return (
    <div className="flex items-center justify-center gap-2 flex-wrap">
      {STEP_ORDER.map((s, i) => {
        const isDone = i < currentIndex;
        const isActive = i === currentIndex;
        return (
          <div key={s} className="flex items-center gap-2">
            <div className={`flex items-center gap-1.5 ${isActive ? "text-foreground" : "text-muted-foreground"}`}>
              <span
                className={`flex h-6 w-6 items-center justify-center rounded-full text-[0.7rem] font-semibold shrink-0 ${
                  isDone
                    ? "bg-verified text-background"
                    : isActive
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-muted-foreground"
                }`}
              >
                {isDone ? "✓" : i + 1}
              </span>
              <span className="label-mono">{STEP_LABELS[s]}</span>
            </div>
            {i < STEP_ORDER.length - 1 && <span className="h-px w-6 bg-border shrink-0" />}
          </div>
        );
      })}
    </div>
  );
}

function ScoreBar({ label, value, gradient }: { label: string; value: number; gradient?: boolean }) {
  const pct = Math.min(100, Math.max(0, value));
  return (
    <div className="space-y-1.5 flex-1 min-w-[140px]">
      <div className="flex items-center justify-between">
        <span className="label-mono text-muted-foreground">{label}</span>
        <span className="font-mono text-sm font-medium text-foreground">
          {value}
          <span className="text-muted-foreground">/100</span>
        </span>
      </div>
      <div className="h-2 rounded-full bg-muted overflow-hidden">
        <div
          className={`h-full rounded-full ${gradient ? "" : "bg-primary"}`}
          style={{
            width: `${pct}%`,
            background: gradient ? "linear-gradient(90deg, #a3ec5c, #6fe0c0)" : undefined,
          }}
        />
      </div>
    </div>
  );
}

function BackHomeLink() {
  return (
    <p className="text-center pt-2">
      <a
        href="/"
        className="inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        Back to home
      </a>
    </p>
  );
}

export default function WeeklyChallenge() {
  const [email, setEmail] = useState("");
  const [emailError, setEmailError] = useState("");
  const [submittedEmail, setSubmittedEmail] = useState<string | null>(null);

  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [challengeId, setChallengeId] = useState<string | null>(null);
  const [questionText, setQuestionText] = useState("");
  const [stats, setStats] = useState<Stats | null>(null);
  const [myAttempt, setMyAttempt] = useState<MyAttempt | null>(null);

  const [answerText, setAnswerText] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const [justSubmittedScore, setJustSubmittedScore] = useState<{
    score: number;
    strengths: string;
    improvements: string;
  } | null>(null);

  async function loadChallenge(forEmail: string) {
    setLoading(true);
    setLoadError("");
    try {
      const res = await fetch(`/api/weekly-challenge?email=${encodeURIComponent(forEmail)}`);
      const data = await res.json();
      if (!res.ok) {
        setLoadError(data.error || "Couldn't load this week's challenge.");
        return;
      }
      setChallengeId(data.challengeId);
      setQuestionText(data.questionText);
      setStats(data.stats);
      setMyAttempt(data.myAttempt || null);
    } catch {
      setLoadError("Failed to reach the server.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (submittedEmail) loadChallenge(submittedEmail);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [submittedEmail]);

  function handleContinue() {
    const trimmed = email.trim().toLowerCase();
    if (!isValidEmail(trimmed)) {
      setEmailError("Enter a valid email.");
      return;
    }
    setEmailError("");
    setSubmittedEmail(trimmed);
  }

  async function handleSubmit() {
    if (!challengeId || !submittedEmail) return;
    if (answerText.trim().length < 15) {
      setSubmitError("Write a bit more before submitting.");
      return;
    }
    setSubmitting(true);
    setSubmitError("");

    try {
      const res = await fetch("/api/weekly-challenge/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ challengeId, email: submittedEmail, answerText }),
      });
      const data = await res.json();

      if (!res.ok) {
        setSubmitError(data.error || "Something went wrong.");
        // Already-attempted is a 409 — refresh so myAttempt populates from the server
        if (res.status === 409) {
          loadChallenge(submittedEmail);
        }
        return;
      }

      setJustSubmittedScore({ score: data.score, strengths: data.strengths, improvements: data.improvements });
      setStats(data.stats);
    } catch {
      setSubmitError("Failed to reach the server.");
    } finally {
      setSubmitting(false);
    }
  }

  // ---------- Email gate ----------
  if (!submittedEmail) {
    return (
      <main className="min-h-screen flex items-center justify-center px-4 py-12" style={{ background: PAGE_GRADIENT }}>
        <div className="w-full max-w-md space-y-5">
          <div className="pb-1">
            <StepIndicator step="email" />
          </div>
          <Card>
            <CardHeader>
              <p className="label-mono mb-1">This week's challenge</p>
              <CardTitle>Weekly Practice Challenge</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-muted-foreground">
                One curated question, shared platform-wide. Enter your email so we can track
                one attempt per person per week and show you the platform average.
              </p>
              <div className="space-y-1.5">
                <Input
                  type="email"
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleContinue()}
                  autoFocus
                />
                {emailError && (
                  <p className="flex items-center gap-1.5 text-sm text-destructive">
                    <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                    {emailError}
                  </p>
                )}
              </div>
              <Button onClick={handleContinue} className="w-full">
                Continue
              </Button>

              <div className="grid grid-cols-3 gap-2 pt-2 text-center">
                <div className="rounded-lg border border-border bg-muted/40 px-2 py-2.5">
                  <p className="text-xs font-semibold text-foreground">No signup</p>
                  <p className="text-[0.7rem] text-muted-foreground mt-0.5">Just an email</p>
                </div>
                <div className="rounded-lg border border-border bg-muted/40 px-2 py-2.5">
                  <p className="text-xs font-semibold text-foreground">New question</p>
                  <p className="text-[0.7rem] text-muted-foreground mt-0.5">Every week</p>
                </div>
                <div className="rounded-lg border border-border bg-muted/40 px-2 py-2.5">
                  <p className="text-xs font-semibold text-foreground">See how</p>
                  <p className="text-[0.7rem] text-muted-foreground mt-0.5">You compare</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <BackHomeLink />
        </div>
      </main>
    );
  }

  // ---------- Loading ----------
  if (loading) {
    return (
      <main className="min-h-screen flex items-center justify-center" style={{ background: PAGE_GRADIENT }}>
        <p className="text-muted-foreground flex items-center gap-2">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading this week's challenge...
        </p>
      </main>
    );
  }

  if (loadError) {
    return (
      <main className="min-h-screen flex items-center justify-center px-4" style={{ background: PAGE_GRADIENT }}>
        <div className="max-w-md w-full space-y-4">
          <Card>
            <CardContent className="py-10 text-center">
              <p className="flex items-center justify-center gap-1.5 text-sm text-destructive">
                <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                {loadError}
              </p>
            </CardContent>
          </Card>
          <BackHomeLink />
        </div>
      </main>
    );
  }

  const resolvedAttempt = justSubmittedScore || myAttempt;
  const alreadyAttempted = !!myAttempt && !justSubmittedScore;
  const uiStep: UiStep = resolvedAttempt ? "result" : "answer";

  return (
    <main className="min-h-screen px-4 py-12" style={{ background: PAGE_GRADIENT }}>
      <div className="mx-auto max-w-2xl space-y-6">
        <div className="text-center space-y-1">
          <p className="label-mono">This week's challenge</p>
          <h1 className="text-2xl font-heading font-semibold">Weekly Practice Challenge</h1>
          <p className="text-muted-foreground text-sm">{submittedEmail}</p>
          <div className="pt-3">
            <StepIndicator step={uiStep} />
          </div>
        </div>

        {!resolvedAttempt ? (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5 items-start">
            <Card className="md:col-span-2">
              <CardHeader>
                <CardTitle className="text-xl">{questionText}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <Textarea
                  placeholder="Write your answer here..."
                  value={answerText}
                  onChange={(e) => setAnswerText(e.target.value)}
                  rows={8}
                  autoFocus
                />
                <p className="text-xs text-muted-foreground/70 text-right">
                  {answerText.trim().length} characters (minimum 15)
                </p>
                {submitError && (
                  <p className="flex items-center gap-1.5 text-sm text-destructive">
                    <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                    {submitError}
                  </p>
                )}
                <Button onClick={handleSubmit} disabled={submitting} className="w-full">
                  {submitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                  {submitting ? "Scoring your answer..." : "Submit Answer"}
                </Button>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <p className="label-mono text-seal mb-1">How it works</p>
                <CardTitle className="text-base">Before you submit</CardTitle>
              </CardHeader>
              <CardContent>
                <ol className="space-y-3 text-sm text-muted-foreground">
                  <li className="flex gap-2.5">
                    <span className="shrink-0 flex h-5 w-5 items-center justify-center rounded-full bg-accent text-accent-foreground text-[0.65rem] font-semibold">1</span>
                    One attempt per person, per week — make it count.
                  </li>
                  <li className="flex gap-2.5">
                    <span className="shrink-0 flex h-5 w-5 items-center justify-center rounded-full bg-accent text-accent-foreground text-[0.65rem] font-semibold">2</span>
                    Your answer is scored by AI on clarity, correctness, and depth.
                  </li>
                  <li className="flex gap-2.5">
                    <span className="shrink-0 flex h-5 w-5 items-center justify-center rounded-full bg-accent text-accent-foreground text-[0.65rem] font-semibold">3</span>
                    Right after submitting, you'll see your score against the platform average.
                  </li>
                </ol>
              </CardContent>
            </Card>
          </div>
        ) : (
          <Card>
            <CardHeader>
              <CardTitle className="text-xl">{questionText}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-5">
              {alreadyAttempted && (
                <p className="label-mono text-muted-foreground/70">
                  You already answered this week's challenge — here's how you did.
                </p>
              )}

              <div className="flex flex-wrap gap-6">
                <ScoreBar label="Your score" value={toDisplayScore(resolvedAttempt.score)} />
                {stats && <ScoreBar label="Platform average" value={toDisplayScore(stats.average_score)} gradient />}
              </div>
              {stats && (
                <p className="label-mono text-muted-foreground/60">
                  {stats.attempt_count} attempt{stats.attempt_count === 1 ? "" : "s"} this week
                </p>
              )}

              {resolvedAttempt.strengths && (
                <div className="space-y-1">
                  <p className="label-mono text-verified">Strengths</p>
                  <p className="text-sm text-foreground">{resolvedAttempt.strengths}</p>
                </div>
              )}
              {resolvedAttempt.improvements && (
                <div className="space-y-1">
                  <p className="label-mono text-seal">Improve</p>
                  <p className="text-sm text-foreground">{resolvedAttempt.improvements}</p>
                </div>
              )}

              <div className="flex flex-col sm:flex-row gap-3 pt-2 border-t border-border">
                <Button asChild variant="outline" className="flex-1 mt-4">
                  <a href="/practice">
                    Keep practicing
                    <ArrowRight className="h-4 w-4 ml-1.5" />
                  </a>
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        <BackHomeLink />
      </div>
    </main>
  );
}