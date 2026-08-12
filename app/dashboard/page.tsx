// TARGET PATH: app/dashboard/page.tsx
"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useRequireAuth } from "@/lib/useAuth";
import { ChevronDown, Download } from "lucide-react";

interface CodingSummary {
  aiScore: number | null;
  testsPassed: number | null;
  testsTotal: number | null;
  language: string | null;
}

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

interface DashboardData {
  stats: {
    totalInterviews: number;
    totalSessions: number;
    avgScore: number;
    avgCodingScore: number;
  };
  interviews: InterviewStat[];
}

function scoreColor(score: number) {
  if (score >= 7) return "text-verified";
  if (score >= 4) return "text-seal";
  return "text-destructive";
}

function ScoreChip({ score, label }: { score: number; label?: string }) {
  return (
    <span className="inline-flex items-center gap-1">
      {label && <span className="label-mono text-muted-foreground">{label}</span>}
      <span className={`font-mono text-sm font-medium ${scoreColor(score)}`}>
        {score}
        <span className="text-muted-foreground text-xs"> /10</span>
      </span>
    </span>
  );
}

export default function Dashboard() {
  const { session, loading: authLoading, logout } = useRequireAuth();

  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [expandedId, setExpandedId] = useState<string | null>(null);

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
                {data.stats.avgScore}
                <span className="text-lg text-muted-foreground"> / 10</span>
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
                {data.stats.avgCodingScore}
                <span className="text-lg text-muted-foreground"> / 10</span>
              </p>
            </CardContent>
          </Card>
        </div>

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
