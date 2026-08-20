// TARGET PATH: app/challenge/page.tsx
"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Loader2, AlertCircle } from "lucide-react";
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
      <main className="min-h-screen bg-background flex items-center justify-center px-4 py-12">
        <Card className="w-full max-w-md">
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
          </CardContent>
        </Card>
      </main>
    );
  }

  // ---------- Loading ----------
  if (loading) {
    return (
      <main className="min-h-screen bg-background flex items-center justify-center">
        <p className="text-muted-foreground">Loading this week's challenge...</p>
      </main>
    );
  }

  if (loadError) {
    return (
      <main className="min-h-screen bg-background flex items-center justify-center px-4">
        <Card className="max-w-md w-full">
          <CardContent className="py-10 text-center text-destructive">{loadError}</CardContent>
        </Card>
      </main>
    );
  }

  const resolvedAttempt = justSubmittedScore || myAttempt;
  const alreadyAttempted = !!myAttempt && !justSubmittedScore;

  return (
    <main className="min-h-screen bg-background px-4 py-12">
      <div className="mx-auto max-w-2xl space-y-6">
        <div className="text-center space-y-1">
          <p className="label-mono">This week's challenge</p>
          <h1 className="text-2xl">Weekly Practice Challenge</h1>
          <p className="text-muted-foreground text-sm">{submittedEmail}</p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-xl">{questionText}</CardTitle>
          </CardHeader>

          {!resolvedAttempt ? (
            <CardContent className="space-y-4">
              <Textarea
                placeholder="Write your answer here..."
                value={answerText}
                onChange={(e) => setAnswerText(e.target.value)}
                rows={8}
                autoFocus
              />
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
          ) : (
            <CardContent className="space-y-4">
              {alreadyAttempted && (
                <p className="label-mono text-muted-foreground/70">
                  You already answered this week's challenge — here's how you did.
                </p>
              )}

              <div className="flex items-center gap-6">
                <div className="space-y-0.5">
                  <p className="label-mono text-muted-foreground">Your score</p>
                  <p className="font-mono text-2xl font-medium text-foreground">
                    {toDisplayScore(resolvedAttempt.score)}
                    <span className="text-muted-foreground text-sm"> /100</span>
                  </p>
                </div>
                {stats && (
                  <div className="space-y-0.5">
                    <p className="label-mono text-muted-foreground">Platform average</p>
                    <p className="font-mono text-2xl font-medium text-foreground">
                      {toDisplayScore(stats.average_score)}
                      <span className="text-muted-foreground text-sm"> /100</span>
                    </p>
                    <p className="label-mono text-muted-foreground/60">
                      {stats.attempt_count} attempt{stats.attempt_count === 1 ? "" : "s"} this week
                    </p>
                  </div>
                )}
              </div>

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
            </CardContent>
          )}
        </Card>
      </div>
    </main>
  );
}