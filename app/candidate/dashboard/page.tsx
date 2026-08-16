// TARGET PATH: app/candidate/dashboard/page.tsx
"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ChevronDown, Loader2, AlertCircle } from "lucide-react";
import {
  ScoreChip,
  Sparkline,
  TrendBadge,
  SubjectStamp,
  SubjectDonut,
  ScoreHistoryChart,
  type CandidateAttempt,
  type SessionDetail,
  type Trend,
} from "@/components/dashboard/charts";

// Raw shape returned by /api/candidate-history (mirrors get_candidate_history()).
interface CandidateHistoryRow {
  session_id: string;
  interview_id: string;
  interview_title: string;
  overall_score: number | null;
  created_at: string;
}

function isValidEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

// Same up/down/flat/insufficient rule as the recruiter dashboard's
// candidate-profile trend (5% dead-zone, latest vs. previous attempt).
// Kept here rather than imported since it lives server-side on that page —
// if /api/dashboard's trend logic ever changes, update both.
function computeTrend(scores: number[]): Trend {
  if (scores.length < 2) return "insufficient";
  const latest = scores[scores.length - 1];
  const previous = scores[scores.length - 2];
  if (previous === 0) return latest === 0 ? "flat" : "up";
  const pctChange = (latest - previous) / previous;
  if (Math.abs(pctChange) < 0.05) return "flat";
  return pctChange > 0 ? "up" : "down";
}

function SessionBreakdown({ sessionId, email }: { sessionId: string; email: string }) {
  const [open, setOpen] = useState(false);
  const [detail, setDetail] = useState<SessionDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleToggle() {
    const next = !open;
    setOpen(next);
    if (next && !detail && !loading) {
      setLoading(true);
      setError("");
      try {
        const res = await fetch("/api/candidate-session-detail", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ sessionId, email }),
        });
        const json = await res.json();
        if (!res.ok) {
          setError(json.error || "Failed to load breakdown.");
          return;
        }
        setDetail(json);
      } catch {
        setError("Failed to reach the server.");
      } finally {
        setLoading(false);
      }
    }
  }

  return (
    <div className="w-full">
      <button
        type="button"
        onClick={handleToggle}
        className="label-mono inline-flex items-center gap-1 text-muted-foreground hover:text-foreground transition-colors"
      >
        <ChevronDown className={`h-3 w-3 transition-transform duration-200 ${open ? "rotate-180" : ""}`} />
        {open ? "Hide breakdown" : "View breakdown"}
      </button>

      {open && (
        <div className="mt-3 rounded-lg border border-border bg-card p-4 space-y-4">
          {loading && <p className="text-sm text-muted-foreground">Loading breakdown...</p>}
          {error && <p className="text-sm text-destructive">{error}</p>}

          {detail && (
            <>
              {detail.overallFeedback && (
                <div className="space-y-1">
                  <p className="label-mono">Examiner&apos;s remarks</p>
                  <p className="text-sm text-foreground">{detail.overallFeedback}</p>
                </div>
              )}

              {detail.subjects.length > 0 && (
                <div className="space-y-1.5">
                  <p className="label-mono">Subject-wise marks</p>
                  <div className="flex flex-col md:flex-row gap-4">
                    <SubjectDonut subjects={detail.subjects} />
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 flex-1">
                      {detail.subjects.map((s) => (
                        <SubjectStamp key={s.subject} subject={s.subject} average={s.average} />
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {(detail.strengths.length > 0 || detail.improvements.length > 0) && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {detail.strengths.length > 0 && (
                    <div className="space-y-1.5">
                      <p className="label-mono text-verified">Noted strengths</p>
                      <ul className="space-y-1">
                        {detail.strengths.map((s, i) => (
                          <li key={i} className="text-sm text-foreground flex gap-1.5">
                            <span className="text-verified">·</span>
                            {s}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {detail.improvements.length > 0 && (
                    <div className="space-y-1.5">
                      <p className="label-mono text-seal">Flagged for improvement</p>
                      <ul className="space-y-1">
                        {detail.improvements.map((s, i) => (
                          <li key={i} className="text-sm text-foreground flex gap-1.5">
                            <span className="text-seal">·</span>
                            {s}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              )}

              {detail.coding && (
                <div className="space-y-1 border-t border-border pt-3">
                  <p className="label-mono">Coding round</p>
                  {detail.coding.questionTitle && (
                    <p className="text-sm text-foreground">{detail.coding.questionTitle}</p>
                  )}
                  <p className="label-mono text-muted-foreground/60">
                    {detail.coding.language || "—"} · {detail.coding.testsPassed ?? "—"}/
                    {detail.coding.testsTotal ?? "—"} tests
                  </p>
                  {detail.coding.aiFeedback && (
                    <p className="text-sm text-muted-foreground">{detail.coding.aiFeedback}</p>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}

export default function CandidateDashboard() {
  const [email, setEmail] = useState("");
  const [emailError, setEmailError] = useState("");
  const [submittedEmail, setSubmittedEmail] = useState<string | null>(null);
  const [rows, setRows] = useState<CandidateHistoryRow[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleLookup() {
    const trimmed = email.trim().toLowerCase();
    if (!isValidEmail(trimmed)) {
      setEmailError("Enter a valid email.");
      return;
    }
    setEmailError("");
    setLoading(true);
    setError("");

    try {
      const res = await fetch("/api/candidate-history", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: trimmed }),
      });
      const json = await res.json();

      if (!res.ok) {
        setError(json.error || "Couldn't load your history.");
        return;
      }

      setRows(json.sessions ?? []);
      setSubmittedEmail(trimmed);
    } catch {
      setError("Failed to reach the server.");
    } finally {
      setLoading(false);
    }
  }

  // ---------- Email gate ----------
  if (!submittedEmail) {
    return (
      <main className="min-h-screen bg-background flex items-center justify-center px-4 py-12">
        <Card className="w-full max-w-md">
          <CardHeader>
            <p className="label-mono mb-1">Mark sheet</p>
            <CardTitle>Your Interview History</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Enter the email you used when taking an interview to see your past scores and progress.
            </p>
            <div className="space-y-1.5">
              <Input
                type="email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleLookup()}
                autoFocus
              />
              {emailError && (
                <p className="flex items-center gap-1.5 text-sm text-destructive">
                  <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                  {emailError}
                </p>
              )}
            </div>
            {error && <p className="text-sm text-destructive">{error}</p>}
            <Button onClick={handleLookup} disabled={loading} className="w-full">
              {loading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {loading ? "Looking up..." : "View My Progress"}
            </Button>
          </CardContent>
        </Card>
      </main>
    );
  }

  // ---------- History view ----------
  const attempts: CandidateAttempt[] = (rows ?? []).map((r) => ({
    sessionId: r.session_id,
    interviewId: r.interview_id,
    interviewTitle: r.interview_title,
    overallScore: r.overall_score,
    createdAt: r.created_at,
    coding: null,
  }));

  const scores = attempts.map((a) => a.overallScore).filter((s): s is number => s !== null);
  const trend = computeTrend(scores);
  const latestScore = scores.length > 0 ? scores[scores.length - 1] : null;
  const bestScore = scores.length > 0 ? Math.max(...scores) : null;

  return (
    <main className="min-h-screen bg-background px-4 py-12">
      <div className="mx-auto max-w-3xl space-y-8">
        <div className="flex items-start justify-between flex-wrap gap-4">
          <div>
            <p className="label-mono mb-1">Mark sheet</p>
            <h1 className="text-3xl">Your Progress</h1>
            <p className="text-muted-foreground mt-1">{submittedEmail}</p>
          </div>
          <button
            type="button"
            onClick={() => {
              setSubmittedEmail(null);
              setRows(null);
              setEmail("");
            }}
            className="label-mono text-muted-foreground hover:text-foreground transition-colors"
          >
            Look up a different email
          </button>
        </div>

        {attempts.length === 0 ? (
          <Card>
            <CardContent className="py-10 text-center text-muted-foreground">
              No interviews found for this email yet. Once you complete a recruiter-shared interview,
              it'll show up here.
            </CardContent>
          </Card>
        ) : (
          <>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
              <Card>
                <CardHeader>
                  <CardTitle className="label-mono font-normal">Attempts</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-3xl font-heading font-bold">{attempts.length}</p>
                </CardContent>
              </Card>
              <Card>
                <CardHeader>
                  <CardTitle className="label-mono font-normal">Latest Score</CardTitle>
                </CardHeader>
                <CardContent>
                  {latestScore !== null ? (
                    <ScoreChip score={latestScore} />
                  ) : (
                    <p className="text-muted-foreground text-sm">—</p>
                  )}
                </CardContent>
              </Card>
              <Card className="col-span-2 sm:col-span-1">
                <CardHeader>
                  <CardTitle className="label-mono font-normal">Trend</CardTitle>
                </CardHeader>
                <CardContent className="flex items-center gap-3">
                  <Sparkline scores={scores} />
                  <TrendBadge trend={trend} />
                </CardContent>
              </Card>
            </div>

            {attempts.length >= 2 && (
              <Card>
                <CardContent className="pt-6">
                  <ScoreHistoryChart attempts={attempts} />
                </CardContent>
              </Card>
            )}

            <Card>
              <CardHeader>
                <CardTitle>Past Attempts</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="divide-y divide-border">
                  {attempts.map((a) => (
                    <div key={a.sessionId} className="py-4 space-y-1">
                      <p className="text-sm text-foreground">{a.interviewTitle}</p>
                      <p className="label-mono">{new Date(a.createdAt).toLocaleString()}</p>
                      {a.overallScore !== null ? (
                        <ScoreChip score={a.overallScore} label="Q&A" />
                      ) : (
                        <span className="label-mono text-muted-foreground/60">Q&amp;A — not scored</span>
                      )}
                      <SessionBreakdown sessionId={a.sessionId} email={submittedEmail} />
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </main>
  );
}