// TARGET PATH: app/dashboard/page.tsx
"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useRequireAuth } from "@/lib/useAuth";
import {
  ChevronDown,
  Download,
  Menu,
  X,
  LayoutDashboard,
  ListChecks,
  Users,
  Lightbulb,
  BarChart3,
  PanelLeftClose,
  LogOut,
  Copy,
  Check,
  Share2,
  Trophy,
  Activity,
  FileDown,
  Loader2,
  AlertCircle,
  Search,
  Sparkles,
} from "lucide-react";
import { toDisplayScore } from "@/lib/scoring";
import {
  ScoreChip,
  Sparkline,
  TrendBadge,
  SubjectStamp,
  SubjectDonut,
  ScoreHistoryChart,
  ScoreHistogram,
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

const NAV_ITEMS = [
  { id: "overview", label: "Overview", Icon: LayoutDashboard },
  { id: "interviews", label: "Interviews", Icon: ListChecks },
  { id: "candidates", label: "Candidates", Icon: Users },
  { id: "insights", label: "Insights", Icon: Lightbulb },
  { id: "analytics", label: "Analytics", Icon: BarChart3 },
] as const;
type SectionId = (typeof NAV_ITEMS)[number]["id"];

// ---------- Client-side derived views (no new API needed) ----------

interface ActivityItem {
  sessionId: string;
  interviewTitle: string;
  createdAt: string;
  overallScore: number | null;
}
function computeRecentActivity(interviews: InterviewStat[], limit = 8): ActivityItem[] {
  const flat: ActivityItem[] = [];
  interviews.forEach((iv) => {
    iv.candidates.forEach((c) => {
      flat.push({
        sessionId: c.sessionId,
        interviewTitle: iv.job_description?.slice(0, 60) || "Untitled interview",
        createdAt: c.created_at,
        overallScore: c.overallScore,
      });
    });
  });
  return flat.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()).slice(0, limit);
}

function computeTopPerformers(profiles: CandidateProfile[], limit = 5): CandidateProfile[] {
  return [...profiles]
    .filter((p) => p.bestScore !== null)
    .sort((a, b) => (b.bestScore ?? 0) - (a.bestScore ?? 0))
    .slice(0, limit);
}

interface CompletionStats {
  totalCandidates: number;
  completed: number;
  pending: number;
}
function computeCompletionStats(interviews: InterviewStat[]): CompletionStats {
  let totalCandidates = 0;
  let completed = 0;
  interviews.forEach((iv) => {
    totalCandidates += iv.candidateCount;
    completed += iv.candidates.filter((c) => c.overallScore !== null).length;
  });
  return { totalCandidates, completed, pending: totalCandidates - completed };
}

// CSV export — plain client-side string building, no library needed.
function exportCandidatesCsv(profiles: CandidateProfile[]) {
  const header = ["Name", "Email", "Attempts", "Latest Score", "Best Score", "Trend"];
  const rows = profiles.map((p) => [
    p.name || "",
    p.email,
    String(p.attempts.length),
    p.latestScore !== null ? String(toDisplayScore(p.latestScore)) : "",
    p.bestScore !== null ? String(toDisplayScore(p.bestScore)) : "",
    p.trend,
  ]);
  const escape = (v: string) => (v.includes(",") || v.includes('"') ? `"${v.replace(/"/g, '""')}"` : v);
  const csv = [header, ...rows].map((r) => r.map(escape).join(",")).join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `candidates-${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// "Duplicate" an interview into a fresh /create session — stashes the job
// description in sessionStorage, /create reads it once on mount and clears
// it. See the matching change in app/create/page.tsx.
function duplicateInterview(jobDescription: string) {
  sessionStorage.setItem("duplicate_job_description", jobDescription);
  window.location.href = "/create";
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

  const [activeSection, setActiveSection] = useState<SectionId>("overview");
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);

  const [copiedInterviewId, setCopiedInterviewId] = useState<string | null>(null);
  const [candidateSearch, setCandidateSearch] = useState("");
  const [candidateSort, setCandidateSort] = useState<"recent" | "highest" | "lowest" | "most_attempts">("recent");

  // Insights — aggregated subject strengths/weaknesses across ALL candidates.
  // Capped to the most recent 40 scored sessions to keep the request count
  // bounded on a free-tier backend; raise this cap later if needed.
  const [subjectAgg, setSubjectAgg] = useState<SubjectScore[] | null>(null);
  const [insightsLoading, setInsightsLoading] = useState(false);
  const [insightsError, setInsightsError] = useState("");
  const [insightsLoaded, setInsightsLoaded] = useState(false);
  const INSIGHTS_SESSION_CAP = 40;

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

  // Lazily aggregate subjects across all candidates the first time Insights
  // is opened. Placed before any early return so hooks stay in a stable
  // order regardless of loading/error state.
  useEffect(() => {
    if (activeSection !== "insights" || insightsLoaded || insightsLoading || !data) return;

    const allSessionIds = data.interviews
      .flatMap((iv) => iv.candidates)
      .filter((c) => c.overallScore !== null)
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
      .slice(0, INSIGHTS_SESSION_CAP)
      .map((c) => c.sessionId);

    if (allSessionIds.length === 0) {
      setInsightsLoaded(true);
      setSubjectAgg([]);
      return;
    }

    let cancelled = false;
    setInsightsLoading(true);
    setInsightsError("");

    Promise.all(
      allSessionIds.map((id) =>
        fetch(`/api/session-detail/${id}`)
          .then((res) => (res.ok ? res.json() : null))
          .catch(() => null)
      )
    )
      .then((details) => {
        if (cancelled) return;
        const agg = new Map<string, { total: number; count: number }>();
        details.forEach((d) => {
          if (!d?.subjects) return;
          (d.subjects as SubjectScore[]).forEach((s) => {
            const cur = agg.get(s.subject) || { total: 0, count: 0 };
            cur.total += s.average;
            cur.count += 1;
            agg.set(s.subject, cur);
          });
        });
        const result: SubjectScore[] = Array.from(agg.entries())
          .map(([subject, v]) => ({ subject, average: v.total / v.count, count: v.count }))
          .sort((a, b) => a.average - b.average);
        setSubjectAgg(result);
        setInsightsLoaded(true);
      })
      .catch(() => {
        if (!cancelled) setInsightsError("Couldn't load insights right now.");
      })
      .finally(() => {
        if (!cancelled) setInsightsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [activeSection, insightsLoaded, insightsLoading, data]);

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

  const recentActivity = computeRecentActivity(data.interviews);
  const topPerformers = computeTopPerformers(data.candidateProfiles);
  const completion = computeCompletionStats(data.interviews);
  const weakestSubject = subjectAgg && subjectAgg.length > 0 ? subjectAgg[0] : null;

  const allScores = data.interviews
    .flatMap((iv) => iv.candidates)
    .map((c) => c.overallScore)
    .filter((s): s is number => s !== null);

  const interviewsByScore = [...data.interviews]
    .filter((iv) => iv.avgScore !== null)
    .sort((a, b) => (b.avgScore ?? 0) - (a.avgScore ?? 0));

  const filteredCandidates = data.candidateProfiles
    .filter((p) => {
      const q = candidateSearch.trim().toLowerCase();
      if (!q) return true;
      return p.email.toLowerCase().includes(q) || (p.name || "").toLowerCase().includes(q);
    })
    .sort((a, b) => {
      if (candidateSort === "recent") {
        return (
          new Date(b.attempts.at(-1)?.createdAt ?? "").getTime() -
          new Date(a.attempts.at(-1)?.createdAt ?? "").getTime()
        );
      }
      if (candidateSort === "most_attempts") return b.attempts.length - a.attempts.length;
      const scoreA = a.bestScore ?? -Infinity;
      const scoreB = b.bestScore ?? -Infinity;
      return candidateSort === "highest" ? scoreB - scoreA : scoreA - scoreB;
    });

  const activeLabel = NAV_ITEMS.find((n) => n.id === activeSection)?.label ?? "";

  return (
    <div className="flex min-h-screen bg-background">
      {/* ---------- SIDEBAR (same pattern as the candidate dashboard) ---------- */}
      <aside
        className={`fixed md:sticky top-0 left-0 h-screen z-40 bg-card border-r border-border flex flex-col shrink-0 transition-all duration-200 w-[232px] ${
          mobileNavOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"
        } ${collapsed ? "md:w-[72px]" : "md:w-[232px]"}`}
      >
        <div className="flex items-center justify-between px-4 py-4 border-b border-border shrink-0">
          {!collapsed && <span className="font-heading font-semibold text-sm">Recruiter</span>}
          <button
            type="button"
            onClick={() => setCollapsed((c) => !c)}
            className="hidden md:flex text-muted-foreground hover:text-foreground p-1 rounded transition-colors"
            title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            <PanelLeftClose className={`h-4 w-4 transition-transform ${collapsed ? "rotate-180" : ""}`} />
          </button>
          <button
            type="button"
            onClick={() => setMobileNavOpen(false)}
            className="md:hidden text-muted-foreground hover:text-foreground p-1 rounded"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <nav className="flex-1 px-2 py-3 space-y-1 overflow-y-auto">
          {NAV_ITEMS.map((item) => {
            const isActive = activeSection === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => {
                  setActiveSection(item.id);
                  setMobileNavOpen(false);
                }}
                title={item.label}
                className={`w-full flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
                  isActive
                    ? "bg-accent text-accent-foreground"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
                }`}
              >
                <item.Icon className="h-4 w-4 shrink-0" />
                {!collapsed && <span className="truncate">{item.label}</span>}
              </button>
            );
          })}
        </nav>

        <div className="px-2 py-3 border-t border-border shrink-0 space-y-1">
          <a
            href="/create"
            title="New interview"
            className="w-full flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-seal hover:bg-muted transition-colors"
          >
            <Sparkles className="h-4 w-4 shrink-0" />
            {!collapsed && <span className="truncate">New Interview</span>}
          </a>
          <button
            type="button"
            onClick={logout}
            title="Log out"
            className="w-full flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
          >
            <LogOut className="h-4 w-4 shrink-0" />
            {!collapsed && <span className="truncate">Log Out</span>}
          </button>
        </div>
      </aside>

      {mobileNavOpen && (
        <div className="fixed inset-0 bg-foreground/40 z-30 md:hidden" onClick={() => setMobileNavOpen(false)} />
      )}

      {/* ---------- MAIN CONTENT ---------- */}
      <div className="flex-1 min-w-0">
        <div className="md:hidden sticky top-0 z-20 flex items-center justify-between px-4 py-3 border-b border-border bg-background/95 backdrop-blur">
          <button type="button" onClick={() => setMobileNavOpen(true)} className="p-2 -ml-2 text-foreground">
            <Menu className="h-5 w-5" />
          </button>
          <span className="label-mono truncate">{activeLabel}</span>
          <span className="w-9" />
        </div>

        <div className="px-4 py-8 md:py-12 max-w-5xl mx-auto space-y-8">
          <div>
            <p className="label-mono mb-1">Mark sheet</p>
            <h1 className="text-3xl font-heading font-semibold">{activeLabel}</h1>
            <p className="text-muted-foreground mt-1">Overview of all interviews and candidate performance</p>
          </div>

          {/* ---------- OVERVIEW ---------- */}
          {activeSection === "overview" && (
            <div className="space-y-6">
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <Card>
                  <CardHeader>
                    <CardTitle className="label-mono font-normal">Interviews Created</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-3xl font-heading font-bold">{data.stats.totalInterviews}</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader>
                    <CardTitle className="label-mono font-normal">Candidate Attempts</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-3xl font-heading font-bold">{data.stats.totalSessions}</p>
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

              {/* Pipeline / completion snapshot — derived from overall_score
                  being null vs not, since there's no separate "link sent"
                  event tracked. This is completion status, not true funnel
                  drop-off. */}
              <Card>
                <CardHeader>
                  <CardTitle className="label-mono font-normal">Completion Status</CardTitle>
                </CardHeader>
                <CardContent>
                  {completion.totalCandidates === 0 ? (
                    <p className="text-sm text-muted-foreground">No candidates yet.</p>
                  ) : (
                    <div className="space-y-2">
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-foreground">
                          {completion.completed} scored / {completion.totalCandidates} total
                        </span>
                        <span className="label-mono text-muted-foreground">
                          {Math.round((completion.completed / completion.totalCandidates) * 100)}% complete
                        </span>
                      </div>
                      <div className="h-2 rounded-full bg-muted overflow-hidden">
                        <div
                          className="h-full rounded-full bg-verified"
                          style={{ width: `${(completion.completed / completion.totalCandidates) * 100}%` }}
                        />
                      </div>
                      {completion.pending > 0 && (
                        <p className="label-mono text-muted-foreground/70">
                          {completion.pending} attempt{completion.pending === 1 ? "" : "s"} still awaiting scoring
                          or in progress
                        </p>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Recent activity feed */}
                <Card>
                  <CardHeader>
                    <CardTitle className="inline-flex items-center gap-1.5">
                      <Activity className="h-4 w-4" />
                      Recent Activity
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    {recentActivity.length === 0 ? (
                      <p className="text-sm text-muted-foreground">No activity yet.</p>
                    ) : (
                      <div className="divide-y divide-border">
                        {recentActivity.map((item) => (
                          <div key={item.sessionId} className="py-2.5 flex items-center justify-between gap-3">
                            <div className="min-w-0">
                              <p className="text-sm text-foreground truncate">{item.interviewTitle}</p>
                              <p className="label-mono">{new Date(item.createdAt).toLocaleString()}</p>
                            </div>
                            {item.overallScore !== null && <ScoreChip score={item.overallScore} />}
                          </div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>

                {/* Top performers leaderboard */}
                <Card>
                  <CardHeader>
                    <CardTitle className="inline-flex items-center gap-1.5">
                      <Trophy className="h-4 w-4" />
                      Top Performers
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    {topPerformers.length === 0 ? (
                      <p className="text-sm text-muted-foreground">No scored candidates yet.</p>
                    ) : (
                      <div className="divide-y divide-border">
                        {topPerformers.map((p, i) => (
                          <div key={p.email} className="py-2.5 flex items-center justify-between gap-3">
                            <div className="flex items-center gap-2.5 min-w-0">
                              <span className="label-mono text-muted-foreground w-4 shrink-0">{i + 1}</span>
                              <p className="text-sm text-foreground truncate">{p.name || p.email}</p>
                            </div>
                            {p.bestScore !== null && <ScoreChip score={p.bestScore} />}
                          </div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>
            </div>
          )}

          {/* ---------- INTERVIEWS ---------- */}
          {activeSection === "interviews" && (
            <Card>
              <CardHeader>
                <CardTitle>Interviews ({data.interviews.length})</CardTitle>
              </CardHeader>
              <CardContent>
                {data.interviews.length === 0 ? (
                  <p className="text-muted-foreground text-sm">No interviews created yet.</p>
                ) : (
                  <div className="space-y-2">
                    {data.interviews.map((interview) => {
                      const isOpen = expandedId === interview.id;
                      const shareLink =
                        typeof window !== "undefined" ? `${window.location.origin}/interview/${interview.id}` : "";
                      return (
                        <div key={interview.id} className="border border-border rounded-lg overflow-hidden">
                          <div className="flex items-start justify-between gap-2 p-4">
                            <button
                              type="button"
                              onClick={() => setExpandedId(isOpen ? null : interview.id)}
                              className="flex-1 min-w-0 text-left"
                            >
                              <p className="text-sm text-foreground line-clamp-2">{interview.job_description}</p>
                              <p className="label-mono mt-1">{new Date(interview.created_at).toLocaleDateString()}</p>
                            </button>
                            <div className="flex items-center gap-2 shrink-0">
                              <span className="label-mono">
                                {interview.candidateCount} candidate{interview.candidateCount !== 1 ? "s" : ""}
                              </span>
                              {interview.avgScore !== null && <ScoreChip score={interview.avgScore} />}
                            </div>
                          </div>

                          <div className="flex items-center gap-2 px-4 pb-3">
                            <button
                              type="button"
                              onClick={async () => {
                                await navigator.clipboard.writeText(shareLink);
                                setCopiedInterviewId(interview.id);
                                setTimeout(() => setCopiedInterviewId(null), 2000);
                              }}
                              className="inline-flex items-center gap-1.5 label-mono border border-border rounded-md px-2.5 py-1.5 hover:bg-muted transition-colors"
                            >
                              {copiedInterviewId === interview.id ? (
                                <>
                                  <Check className="h-3.5 w-3.5 text-verified" />
                                  Copied!
                                </>
                              ) : (
                                <>
                                  <Share2 className="h-3.5 w-3.5" />
                                  Copy Link
                                </>
                              )}
                            </button>
                            <button
                              type="button"
                              onClick={() => duplicateInterview(interview.job_description)}
                              className="inline-flex items-center gap-1.5 label-mono border border-border rounded-md px-2.5 py-1.5 hover:bg-muted transition-colors"
                            >
                              <Copy className="h-3.5 w-3.5" />
                              Duplicate
                            </button>
                            <button
                              type="button"
                              onClick={() => setExpandedId(isOpen ? null : interview.id)}
                              className="ml-auto p-1.5 text-muted-foreground hover:text-foreground transition-colors"
                            >
                              <ChevronDown
                                className={`h-4 w-4 transition-transform duration-200 ${isOpen ? "rotate-180" : ""}`}
                              />
                            </button>
                          </div>

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
                                        <p className="label-mono">{new Date(c.created_at).toLocaleString()}</p>
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
                                              {c.coding.testsPassed}/{c.coding.testsTotal} tests · {c.coding.language}
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
          )}

          {/* ---------- CANDIDATES ---------- */}
          {activeSection === "candidates" && (
            <Card>
              <CardHeader>
                <CardTitle>
                  Candidates ({filteredCandidates.length}
                  {filteredCandidates.length !== data.candidateProfiles.length
                    ? ` of ${data.candidateProfiles.length}`
                    : ""}
                  )
                </CardTitle>
                <div className="flex flex-col sm:flex-row gap-2 pt-2">
                  <div className="relative flex-1">
                    <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                    <Input
                      value={candidateSearch}
                      onChange={(e) => setCandidateSearch(e.target.value)}
                      placeholder="Search by name or email..."
                      className="pl-8"
                    />
                  </div>
                  <select
                    value={candidateSort}
                    onChange={(e) => setCandidateSort(e.target.value as typeof candidateSort)}
                    className="label-mono border border-border rounded-md px-2 py-1 bg-background transition-colors focus:outline-none focus:ring-2 focus:ring-ring/40"
                  >
                    <option value="recent">Most recent</option>
                    <option value="highest">Highest score</option>
                    <option value="lowest">Lowest score</option>
                    <option value="most_attempts">Most attempts</option>
                  </select>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => exportCandidatesCsv(data.candidateProfiles)}
                    className="shrink-0"
                  >
                    <FileDown className="h-3.5 w-3.5 mr-1.5" />
                    Export CSV
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {filteredCandidates.length === 0 ? (
                  <p className="text-muted-foreground text-sm">
                    {data.candidateProfiles.length === 0
                      ? "No candidate emails captured yet — profiles appear once a candidate enters their email at the start of an interview."
                      : `No candidates match "${candidateSearch}".`}
                  </p>
                ) : (
                  <div className="space-y-2">
                    {filteredCandidates.map((profile) => {
                      const isOpen = expandedEmail === profile.email;
                      const scores = profile.attempts
                        .map((a) => a.overallScore)
                        .filter((s): s is number => s !== null);

                      return (
                        <div key={profile.email} className="border border-border rounded-lg overflow-hidden">
                          <button
                            type="button"
                            onClick={() => setExpandedEmail(isOpen ? null : profile.email)}
                            className="w-full flex items-start justify-between gap-4 p-4 text-left hover:bg-muted/50 transition-colors"
                          >
                            <div className="flex-1 min-w-0">
                              <p className="text-sm text-foreground font-medium">{profile.name || profile.email}</p>
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
                                {profile.attempts.length >= 2 && <ScoreHistoryChart attempts={profile.attempts} />}
                                <div className="divide-y divide-border">
                                  {profile.attempts.map((a) => (
                                    <div
                                      key={a.sessionId}
                                      className="py-3 flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2"
                                    >
                                      <div className="space-y-1">
                                        <p className="text-sm text-foreground line-clamp-1">{a.interviewTitle}</p>
                                        <p className="label-mono">{new Date(a.createdAt).toLocaleString()}</p>
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
          )}

          {/* ---------- INSIGHTS ---------- */}
          {activeSection === "insights" && (
            <Card>
              <CardHeader>
                <CardTitle>Subject Strengths &amp; Weaknesses Across Candidates</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <p className="text-xs text-muted-foreground">
                  Based on the {Math.min(INSIGHTS_SESSION_CAP, data.stats.totalSessions)} most recent scored
                  sessions across all your interviews.
                </p>
                {insightsLoading && (
                  <p className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Averaging scores across candidates...
                  </p>
                )}
                {insightsError && (
                  <p className="flex items-center gap-1.5 text-sm text-destructive">
                    <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                    {insightsError}
                  </p>
                )}
                {!insightsLoading && subjectAgg && subjectAgg.length === 0 && (
                  <p className="text-sm text-muted-foreground">No subject-level scoring found yet.</p>
                )}
                {subjectAgg && subjectAgg.length > 0 && (
                  <>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                      {subjectAgg.map((s) => (
                        <SubjectStamp key={s.subject} subject={s.subject} average={s.average} />
                      ))}
                    </div>
                    {weakestSubject && (
                      <div className="rounded-lg border border-seal/40 bg-accent p-4">
                        <p className="text-sm text-accent-foreground">
                          <span className="font-semibold">{weakestSubject.subject}</span> is where candidates score
                          lowest on average across your interviews — worth reviewing whether the question difficulty
                          or phrasing needs adjusting.
                        </p>
                      </div>
                    )}
                  </>
                )}
              </CardContent>
            </Card>
          )}

          {/* ---------- ANALYTICS ---------- */}
          {activeSection === "analytics" && (
            <div className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>Score Distribution</CardTitle>
                </CardHeader>
                <CardContent>
                  {allScores.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No scored sessions yet.</p>
                  ) : (
                    <ScoreHistogram scores={allScores} />
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Average Score by Interview</CardTitle>
                </CardHeader>
                <CardContent>
                  {interviewsByScore.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No scored interviews yet.</p>
                  ) : (
                    <div className="space-y-3">
                      {interviewsByScore.map((iv) => {
                        const pct = Math.max(0, Math.min(10, iv.avgScore ?? 0)) * 10;
                        return (
                          <div key={iv.id} className="space-y-1">
                            <div className="flex items-center justify-between text-sm gap-2">
                              <span className="text-foreground truncate">
                                {iv.job_description?.slice(0, 50) || "Untitled interview"}
                              </span>
                              <span className={`font-mono text-xs font-medium shrink-0 ${scoreColor(iv.avgScore ?? 0)}`}>
                                {toDisplayScore(iv.avgScore ?? 0)}/100
                              </span>
                            </div>
                            <div className="h-2 rounded-full bg-muted overflow-hidden">
                              <div className="h-full rounded-full bg-seal" style={{ width: `${pct}%` }} />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}