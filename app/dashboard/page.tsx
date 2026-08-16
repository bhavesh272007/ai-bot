// TARGET PATH: app/dashboard/page.tsx
"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useRequireAuth } from "@/lib/useAuth";
import { ChevronDown, Download } from "lucide-react";
import { toDisplayScore } from "@/lib/scoring";
import {
  ScoreChip,
  Sparkline,
  TrendBadge,
  SubjectStamp,
  SubjectDonut,
  ScoreHistoryChart,
  scoreColor,
  type CodingSummary,
  type CandidateAttempt,
  type SubjectScore,
  type SessionDetail,
} from "@/components/dashboard/charts";

interface Candidate {
  sessionId: string;
  created_at: string;
  overallScore: number | null;
  overallFeedback: string | null;
  coding: CodingSummary | null;
}

interface InterviewStat {
  id: string;
  job_description: string;
  created_at: string;
  candidateCount: number;
  avgScore: number | null;
  candidates: Candidate[];
}

interface CandidateProfile {
  email: string;
  name: string | null;
  attempts: CandidateAttempt[];
  trend: "up" | "down" | "flat" | "insufficient";
  latestScore: number | null;
  bestScore: number | null;
}

interface DashboardData {
  stats: {
    totalInterviews: number;
    totalSessions: number;
    avgScore: number;
    avgCodingScore: number;
  };
  interviews: InterviewStat[];
  candidateProfiles: CandidateProfile[];
}

function AttemptDetailToggle({ attempt }: { attempt: CandidateAttempt }) {
  const [open, setOpen] = useState(false);
  const [detail, setDetail] = useState<SessionDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [detailError, setDetailError] = useState("");

  async function handleToggle() {
    const next = !open;
    setOpen(next);
    if (next && !detail && !loading) {
      setLoading(true);
      setDetailError("");
      try {
        const res = await fetch(`/api/session-detail/${attempt.sessionId}`);
        const json = await res.json();
        if (!res.ok) {
          setDetailError(json.error || "Failed to load breakdown.");
          return;
        }
        setDetail(json);
      } catch {
        setDetailError("Failed to reach the server.");
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
          {detailError && <p className="text-sm text-destructive">{detailError}</p>}

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

export default function Dashboard() {
  const { session, loading: authLoading, logout } = useRequireAuth();

  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [expandedEmail, setExpandedEmail] = useState<string | null>(null);

  useEffect(() => {
    if (!session) return;

    async function loadDashboard() {
      try {
        const res = await fetch("/api/dashboard", {
          headers: {
            Authorization: `Bearer ${session?.access_token}`,
          },
        });
        const json = await res.json();

        if (!res.ok) {
          setError(json.error || "Failed to load dashboard.");
          return;
        }

        setData(json);
      } catch (err) {
        setError("Failed to reach the server.");
      } finally {
        setLoading(false);
      }
    }

    loadDashboard();
  }, [session]);

  if (authLoading || (loading && session)) {
    return (
      <main className="min-h-screen bg-background flex items-center justify-center">
        <p className="text-muted-foreground">Loading dashboard...</p>
      </main>
    );
  }

  if (error || !data) {
    return (
      <main className="min-h-screen bg-background flex items-center justify-center">
        <p className="text-destructive">{error || "No data available."}</p>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-background px-4 py-12">
      <div className="mx-auto max-w-5xl space-y-8">
        <div className="flex items-start justify-between">
          <div>
            <p className="label-mono mb-1">Mark sheet</p>
            <h1 className="text-3xl">Recruiter Dashboard</h1>
            <p className="text-muted-foreground mt-1">
              Overview of all interviews and candidate performance
            </p>
          </div>
          <div className="flex items-center gap-4 text-sm shrink-0 pt-1">
            <a href="/create" className="text-seal hover:underline font-medium">
              ← New Interview
            </a>
            <button onClick={logout} className="text-muted-foreground hover:underline">
              Log Out
            </button>
          </div>
        </div>

        {/* Stat cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <Card>
            <CardHeader>
              <CardTitle className="label-mono font-normal">
                Interviews Created
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-heading font-bold">
                {data.stats.totalInterviews}
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="label-mono font-normal">
                Candidate Attempts
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-heading font-bold">
                {data.stats.totalSessions}
              </p>
            </CardContent>
          </Card>
          <Card className="relative overflow-hidden">
            <CardHeader>
              <CardTitle className="label-mono font-normal">Avg Q&amp;A Score</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-heading font-bold">
                {toDisplayScore(data.stats.avgScore)}
                <span className="text-lg text-muted-foreground"> / 100</span>
              </p>
            </CardContent>
            <div className="seal-badge w-16 h-16 absolute -top-3 -right-3 opacity-15" />
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="label-mono font-normal">Avg Coding Score</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-heading font-bold">
                {toDisplayScore(data.stats.avgCodingScore)}
                <span className="text-lg text-muted-foreground"> / 100</span>
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Candidate profiles — grouped by self-reported email across all interviews */}
        <Card>
          <CardHeader>
            <CardTitle>Candidate Profiles</CardTitle>
          </CardHeader>
          <CardContent>
            {data.candidateProfiles.length === 0 ? (
              <p className="text-muted-foreground text-sm">
                No candidate emails captured yet — profiles appear once a candidate enters their email at the start of an interview.
              </p>
            ) : (
              <div className="space-y-2">
                {data.candidateProfiles.map((profile) => {
                  const isOpen = expandedEmail === profile.email;
                  const scores = profile.attempts
                    .map((a) => a.overallScore)
                    .filter((s): s is number => s !== null);

                  return (
                    <div
                      key={profile.email}
                      className="border border-border rounded-lg overflow-hidden"
                    >
                      <button
                        type="button"
                        onClick={() => setExpandedEmail(isOpen ? null : profile.email)}
                        className="w-full flex items-start justify-between gap-4 p-4 text-left hover:bg-muted/50 transition-colors"
                      >
                        <div className="flex-1 min-w-0">
                          <p className="text-sm text-foreground font-medium">
                            {profile.name || profile.email}
                          </p>
                          <p className="label-mono mt-1">
                            {profile.email} · {profile.attempts.length} attempt
                            {profile.attempts.length !== 1 ? "s" : ""}
                          </p>
                        </div>
                        <div className="flex items-center gap-3 shrink-0">
                          <Sparkline scores={scores} />
                          <TrendBadge trend={profile.trend} />
                          {profile.latestScore !== null && (
                            <ScoreChip score={profile.latestScore} label="Latest" />
                          )}
                          <ChevronDown
                            className={`h-4 w-4 text-muted-foreground transition-transform duration-200 ${
                              isOpen ? "rotate-180" : ""
                            }`}
                          />
                        </div>
                      </button>

                      <div
                        className={`grid transition-all duration-200 ease-in-out ${
                          isOpen ? "grid-rows-[1fr]" : "grid-rows-[0fr]"
                        }`}
                      >
                        <div className="overflow-hidden">
                          <div className="border-t border-border bg-muted/30 px-4 py-3 space-y-4">
                            {profile.attempts.length >= 2 && (
                              <ScoreHistoryChart attempts={profile.attempts} />
                            )}
                            <div className="divide-y divide-border">
                            {profile.attempts.map((a) => (
                              <div
                                key={a.sessionId}
                                className="py-3 flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2"
                              >
                                <div className="space-y-1">
                                  <p className="text-sm text-foreground line-clamp-1">
                                    {a.interviewTitle}
                                  </p>
                                  <p className="label-mono">
                                    {new Date(a.createdAt).toLocaleString()}
                                  </p>
                                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
                                    {a.overallScore !== null ? (
                                      <ScoreChip score={a.overallScore} label="Q&A" />
                                    ) : (
                                      <span className="label-mono text-muted-foreground/60">
                                        Q&amp;A — not scored
                                      </span>
                                    )}
                                    {a.coding && a.coding.aiScore !== null ? (
                                      <ScoreChip score={a.coding.aiScore} label="Coding" />
                                    ) : (
                                      <span className="label-mono text-muted-foreground/60">
                                        Coding — not attempted
                                      </span>
                                    )}
                                  </div>
                                  <AttemptDetailToggle attempt={a} />
                                </div>
                                <a
                                  href={`/api/session-report/${a.sessionId}`}
                                  className="inline-flex items-center gap-1.5 label-mono border border-border rounded-md px-3 py-1.5 shrink-0 hover:bg-muted transition-colors self-start sm:self-auto"
                                >
                                  <Download className="h-3.5 w-3.5" />
                                  PDF Report
                                </a>
                              </div>
                            ))}
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Interviews — expandable candidate rows */}
        <Card>
          <CardHeader>
            <CardTitle>Interviews</CardTitle>
          </CardHeader>
          <CardContent>
            {data.interviews.length === 0 ? (
              <p className="text-muted-foreground text-sm">No interviews created yet.</p>
            ) : (
              <div className="space-y-2">
                {data.interviews.map((interview) => {
                  const isOpen = expandedId === interview.id;
                  return (
                    <div
                      key={interview.id}
                      className="border border-border rounded-lg overflow-hidden"
                    >
                      <button
                        type="button"
                        onClick={() => setExpandedId(isOpen ? null : interview.id)}
                        className="w-full flex items-start justify-between gap-4 p-4 text-left hover:bg-muted/50 transition-colors"
                      >
                        <div className="flex-1 min-w-0">
                          <p className="text-sm text-foreground line-clamp-2">
                            {interview.job_description}
                          </p>
                          <p className="label-mono mt-1">
                            {new Date(interview.created_at).toLocaleDateString()}
                          </p>
                        </div>
                        <div className="flex items-center gap-3 shrink-0">
                          <span className="label-mono">
                            {interview.candidateCount} candidate
                            {interview.candidateCount !== 1 ? "s" : ""}
                          </span>
                          {interview.avgScore !== null && (
                            <ScoreChip score={interview.avgScore} />
                          )}
                          <ChevronDown
                            className={`h-4 w-4 text-muted-foreground transition-transform duration-200 ${
                              isOpen ? "rotate-180" : ""
                            }`}
                          />
                        </div>
                      </button>

                      <div
                        className={`grid transition-all duration-200 ease-in-out ${
                          isOpen ? "grid-rows-[1fr]" : "grid-rows-[0fr]"
                        }`}
                      >
                        <div className="overflow-hidden">
                          <div className="border-t border-border bg-muted/30 px-4 py-2 divide-y divide-border">
                            {interview.candidates.length === 0 ? (
                              <p className="text-sm text-muted-foreground py-3">
                                No candidates have attempted this interview yet.
                              </p>
                            ) : (
                              interview.candidates.map((c) => (
                                <div
                                  key={c.sessionId}
                                  className="py-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2"
                                >
                                  <div className="space-y-1">
                                    <p className="label-mono">
                                      {new Date(c.created_at).toLocaleString()}
                                    </p>
                                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
                                      {c.overallScore !== null ? (
                                        <ScoreChip score={c.overallScore} label="Q&A" />
                                      ) : (
                                        <span className="label-mono text-muted-foreground/60">
                                          Q&amp;A — not scored
                                        </span>
                                      )}
                                      {c.coding && c.coding.aiScore !== null ? (
                                        <ScoreChip score={c.coding.aiScore} label="Coding" />
                                      ) : (
                                        <span className="label-mono text-muted-foreground/60">
                                          Coding — not attempted
                                        </span>
                                      )}
                                      {c.coding && (
                                        <span className="label-mono text-muted-foreground/60">
                                          {c.coding.testsPassed}/{c.coding.testsTotal} tests ·{" "}
                                          {c.coding.language}
                                        </span>
                                      )}
                                    </div>
                                  </div>
                                  <a
                                    href={`/api/session-report/${c.sessionId}`}
                                    className="inline-flex items-center gap-1.5 label-mono border border-border rounded-md px-3 py-1.5 shrink-0 hover:bg-muted transition-colors self-start sm:self-auto"
                                  >
                                    <Download className="h-3.5 w-3.5" />
                                    PDF Report
                                  </a>
                                </div>
                              ))
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </main>
  );
}