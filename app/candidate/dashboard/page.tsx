// TARGET PATH: app/candidate/dashboard/page.tsx
"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  ChevronDown,
  Loader2,
  AlertCircle,
  Menu,
  X,
  LayoutDashboard,
  Flame,
  LineChart,
  ListChecks,
  Award,
  PanelLeftClose,
  LogOut,
  Download,
  Lightbulb,
  User,
  Search,
  ArrowRight,
  Sparkles,
  Code2,
  Clock,
  Share2,
  Copy,
  Check,
  Gauge,
} from "lucide-react";
import {
  ScoreChip,
  Sparkline,
  TrendBadge,
  StreakBadge,
  SubjectStamp,
  SubjectDonut,
  ScoreHistoryChart,
  ConsistencyCalendar,
  AchievementGrid,
  RadarChart,
  SubjectProgressBars,
  ScoreHistogram,
  MiniScoreBar,
  type CandidateAttempt,
  type SessionDetail,
  type Trend,
  type StreakData,
  type Achievement,
  type SubjectScore,
} from "@/components/dashboard/charts";
import { toDisplayScore } from "@/lib/scoring";

// Raw shape returned by /api/candidate-history (mirrors get_candidate_history()).
// NOTE: candidate_name assumes the SQL function already selects it — the
// interview intake flow (app/interview/[id]/page.tsx) already collects and
// stores a candidateName at session creation, so the column should exist.
// If get_candidate_history() doesn't SELECT it yet, add it there and the
// Profile section below will start populating with no other changes needed.
interface CandidateHistoryRow {
  session_id: string;
  interview_id: string;
  interview_title: string;
  overall_score: number | null;
  created_at: string;
  candidate_name?: string | null;
  coding_ai_score?: number | null;
  coding_tests_passed?: number | null;
  coding_tests_total?: number | null;
  coding_language?: string | null;
}

const PAGE_GRADIENT =
  "radial-gradient(circle at 50% 0%, #f2ff6b 0%, #d4f24f 10%, transparent 32%), linear-gradient(180deg, #c6f24a 0%, #a3ec5c 8%, #7fe3a0 16%, #6fe0c0 24%, #7fe8dd 32%, #cdf3ec 42%, #ffffff 56%)";

const NAV_ITEMS = [
  { id: "overview", label: "Overview", Icon: LayoutDashboard },
  { id: "insights", label: "Insights", Icon: Lightbulb },
  { id: "consistency", label: "Consistency", Icon: Flame },
  { id: "history", label: "Score History", Icon: LineChart },
  { id: "coding", label: "Coding", Icon: Code2 },
  { id: "attempts", label: "Past Attempts", Icon: ListChecks },
  { id: "achievements", label: "Achievements", Icon: Award },
] as const;
type SectionId = (typeof NAV_ITEMS)[number]["id"] | "profile";
const SECTION_LABELS: Record<SectionId, string> = {
  overview: "Overview",
  insights: "Insights",
  consistency: "Consistency",
  history: "Score History",
  coding: "Coding",
  attempts: "Past Attempts",
  achievements: "Achievements",
  profile: "Profile",
};

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

const WEEKDAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

// Which day of the week the candidate practices on most — purely derived
// from timestamps already on the page, no new API call.
function computeFavoriteDay(attempts: CandidateAttempt[]): string | null {
  if (attempts.length === 0) return null;
  const counts = [0, 0, 0, 0, 0, 0, 0];
  attempts.forEach((a) => counts[new Date(a.createdAt).getDay()]++);
  const max = Math.max(...counts);
  if (max === 0) return null;
  return WEEKDAY_NAMES[counts.indexOf(max)];
}

// Longest gap between two consecutive attempts, in days.
function computeLongestGapDays(attempts: CandidateAttempt[]): number | null {
  if (attempts.length < 2) return null;
  const sorted = [...attempts].sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
  let maxGap = 0;
  for (let i = 1; i < sorted.length; i++) {
    const gap =
      (new Date(sorted[i].createdAt).getTime() - new Date(sorted[i - 1].createdAt).getTime()) / 86400000;
    if (gap > maxGap) maxGap = gap;
  }
  return Math.round(maxGap);
}

// Largest score increase between two consecutive attempts (chronological).
function computeBiggestJump(attempts: CandidateAttempt[]): { from: number; to: number; date: string } | null {
  const scored = attempts
    .filter((a): a is CandidateAttempt & { overallScore: number } => a.overallScore !== null)
    .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
  if (scored.length < 2) return null;
  let best: { from: number; to: number; date: string; delta: number } | null = null;
  for (let i = 1; i < scored.length; i++) {
    const delta = scored[i].overallScore - scored[i - 1].overallScore;
    if (!best || delta > best.delta) {
      best = { from: scored[i - 1].overallScore, to: scored[i].overallScore, date: scored[i].createdAt, delta };
    }
  }
  return best && best.delta > 0 ? best : null;
}

// Readiness Score — a transparent composite, not a mysterious black-box
// number: 60% latest score (display scale), 25% trend direction, 15% an
// active streak bonus. All three inputs are already shown elsewhere on the
// dashboard, this just blends them into one headline number.
function computeReadinessScore(
  latestScore: number | null,
  trend: Trend,
  currentStreak: number
): number | null {
  if (latestScore === null) return null;
  const scorePart = toDisplayScore(latestScore) * 0.6; // up to 60
  const trendPart = { up: 25, flat: 15, insufficient: 15, down: 5 }[trend]; // up to 25
  const streakPart = (Math.min(currentStreak, 7) / 7) * 15; // up to 15
  return Math.round(Math.min(100, scorePart + trendPart + streakPart));
}

// Next milestone — the closest not-yet-achieved achievement, expressed as
// a "current / target" progress bar rather than a flat locked badge.
interface NextMilestone {
  label: string;
  current: number;
  target: number;
}
function computeNextMilestone(attemptCount: number, longestStreak: number): NextMilestone | null {
  const attemptTargets = [1, 5, 10, 25];
  const attemptLabels = ["First Steps", "Getting Serious", "Veteran", "Master"];
  for (let i = 0; i < attemptTargets.length; i++) {
    if (attemptCount < attemptTargets[i]) {
      return { label: attemptLabels[i], current: attemptCount, target: attemptTargets[i] };
    }
  }
  const streakTargets = [3, 7, 14, 30];
  const streakLabels = ["On a Roll", "Locked In", "Two Weeks Strong", "Unstoppable"];
  for (let i = 0; i < streakTargets.length; i++) {
    if (longestStreak < streakTargets[i]) {
      return { label: streakLabels[i], current: longestStreak, target: streakTargets[i] };
    }
  }
  return null;
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
  const [streak, setStreak] = useState<StreakData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const [activeSection, setActiveSection] = useState<SectionId>("overview");
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);

  const [attemptSearch, setAttemptSearch] = useState("");
  const [attemptSort, setAttemptSort] = useState<"newest" | "oldest" | "highest" | "lowest">("newest");

  const [subjectAgg, setSubjectAgg] = useState<SubjectScore[] | null>(null);
  const [insightsLoading, setInsightsLoading] = useState(false);
  const [insightsError, setInsightsError] = useState("");
  const [insightsLoaded, setInsightsLoaded] = useState(false);

  // Platform-comparison percentile — NOT confirmed to exist as a backend
  // route. This tries /api/candidate-percentile once; if it 404s or errors,
  // we show an honest "not available yet" state instead of a fake number.
  const [percentile, setPercentile] = useState<number | null>(null);
  const [percentileSampleSize, setPercentileSampleSize] = useState<number>(0);
  const [percentileAvailable, setPercentileAvailable] = useState<boolean | null>(null); // null = not checked yet

  const [shareCopied, setShareCopied] = useState(false);

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
      const [historyRes, streakRes] = await Promise.all([
        fetch("/api/candidate-history", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email: trimmed }),
        }),
        fetch("/api/candidate-streak", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email: trimmed }),
        }),
      ]);

      const historyJson = await historyRes.json();
      if (!historyRes.ok) {
        setError(historyJson.error || "Couldn't load your history.");
        return;
      }

      setRows(historyJson.sessions ?? []);
      setSubmittedEmail(trimmed);

      // Streak is a nice-to-have — don't fail the whole lookup if it errors.
      if (streakRes.ok) {
        setStreak(await streakRes.json());
      }
    } catch {
      setError("Failed to reach the server.");
    } finally {
      setLoading(false);
    }
  }

  function switchEmail() {
    setSubmittedEmail(null);
    setRows(null);
    setStreak(null);
    setEmail("");
    setActiveSection("overview");
    setMobileNavOpen(false);
    setSubjectAgg(null);
    setInsightsLoaded(false);
    setInsightsError("");
    setAttemptSearch("");
    setAttemptSort("newest");
  }

  // Lazily aggregate subject scores across all attempts the first time the
  // Insights section is opened — fetches each session's detail once and
  // caches the result, so switching sections afterward doesn't refetch.
  // Placed before the early return below so the hook always runs in the
  // same order, per the Rules of Hooks.
  useEffect(() => {
    if (activeSection !== "insights" || insightsLoaded || insightsLoading || !submittedEmail || !rows || rows.length === 0) {
      return;
    }

    let cancelled = false;
    setInsightsLoading(true);
    setInsightsError("");

    Promise.all(
      rows.map((r) =>
        fetch("/api/candidate-session-detail", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ sessionId: r.session_id, email: submittedEmail }),
        })
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
  }, [activeSection, insightsLoaded, insightsLoading, submittedEmail, rows]);

  // Calls the real /api/candidate-percentile endpoint (backed by
  // get_candidate_percentile() in Supabase — compares this candidate's BEST
  // score against every other candidate's best score). Returns
  // { percentile: null, sample_size: N } when there aren't enough other
  // candidates yet to make a percentile meaningful — that's a legitimate
  // response, not an error, so it's tracked separately from a hard failure.
  useEffect(() => {
    if (!submittedEmail || percentileAvailable !== null) return;
    let cancelled = false;

    fetch("/api/candidate-percentile", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: submittedEmail }),
    })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (cancelled) return;
        if (data && typeof data.sample_size === "number") setPercentileSampleSize(data.sample_size);
        if (data && typeof data.percentile === "number") {
          setPercentile(data.percentile);
          setPercentileAvailable(true);
        } else {
          setPercentileAvailable(false);
        }
      })
      .catch(() => {
        if (!cancelled) setPercentileAvailable(false);
      });

    return () => {
      cancelled = true;
    };
  }, [submittedEmail, percentileAvailable]);

  // ---------- Email gate ----------
  if (!submittedEmail) {
    return (
      <main className="min-h-screen flex items-center justify-center px-4 py-12" style={{ background: PAGE_GRADIENT }}>
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
  const attempts: CandidateAttempt[] = (rows ?? []).map((r) => {
    const hasCoding =
      r.coding_ai_score != null ||
      r.coding_tests_passed != null ||
      r.coding_tests_total != null ||
      r.coding_language != null;
    return {
      sessionId: r.session_id,
      interviewId: r.interview_id,
      interviewTitle: r.interview_title,
      overallScore: r.overall_score,
      createdAt: r.created_at,
      coding: hasCoding
        ? {
            aiScore: r.coding_ai_score ?? null,
            testsPassed: r.coding_tests_passed ?? null,
            testsTotal: r.coding_tests_total ?? null,
            language: r.coding_language ?? null,
          }
        : null,
    };
  });

  const scores = attempts.map((a) => a.overallScore).filter((s): s is number => s !== null);
  const trend = computeTrend(scores);
  const latestScore = scores.length > 0 ? scores[scores.length - 1] : null;
  const bestScore = scores.length > 0 ? Math.max(...scores) : null;
  const worstScore = scores.length > 0 ? Math.min(...scores) : null;

  const achievements: Achievement[] = [
    { label: "First Steps", description: "Complete your first interview", achieved: attempts.length >= 1 },
    { label: "Getting Serious", description: "Complete 5 interviews", achieved: attempts.length >= 5 },
    { label: "Veteran", description: "Complete 10 interviews", achieved: attempts.length >= 10 },
    { label: "On a Roll", description: "3-day practice streak", achieved: (streak?.longest_streak ?? 0) >= 3 },
    { label: "Locked In", description: "7-day practice streak", achieved: (streak?.longest_streak ?? 0) >= 7 },
    {
      label: "High Scorer",
      description: "Score 80+ on an attempt",
      achieved: bestScore !== null && toDisplayScore(bestScore) >= 80,
    },
  ];

  // Profile name — most recent attempt that has a non-null candidate_name.
  // See the note on CandidateHistoryRow above re: backend assumption.
  const profileName =
    [...(rows ?? [])]
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
      .find((r) => r.candidate_name)?.candidate_name ?? null;

  const favoriteDay = computeFavoriteDay(attempts);
  const longestGapDays = computeLongestGapDays(attempts);
  const biggestJump = computeBiggestJump(attempts);
  const weakestSubject = subjectAgg && subjectAgg.length > 0 ? subjectAgg[0] : null;
  const careerChatPrompt = weakestSubject
    ? `I tend to score lowest on ${weakestSubject.subject} questions in my mock interviews. Can you give me specific tips to improve in this area?`
    : "";

  const filteredAttempts = attempts
    .filter((a) => a.interviewTitle.toLowerCase().includes(attemptSearch.trim().toLowerCase()))
    .sort((a, b) => {
      if (attemptSort === "newest") return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      if (attemptSort === "oldest") return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
      const scoreA = a.overallScore ?? -Infinity;
      const scoreB = b.overallScore ?? -Infinity;
      return attemptSort === "highest" ? scoreB - scoreA : scoreA - scoreB;
    });

  const activeLabel = SECTION_LABELS[activeSection];

  const readinessScore = computeReadinessScore(latestScore, trend, streak?.current_streak ?? 0);
  const nextMilestone = computeNextMilestone(attempts.length, streak?.longest_streak ?? 0);
  const initials = (profileName || submittedEmail)
    .split(/[\s@.]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase())
    .join("");

  // Coding-specific aggregate — CandidateAttempt.coding is always null from
  // the current /api/candidate-history response (see the type in charts.tsx),
  // so this will show the empty state until that endpoint is extended to
  // join and return coding results per session. Written now so the panel
  // "just works" the moment that data starts flowing.
  const codingAttempts = attempts.filter((a) => a.coding !== null);
  const codingLanguages = new Map<string, number>();
  codingAttempts.forEach((a) => {
    if (a.coding?.language) codingLanguages.set(a.coding.language, (codingLanguages.get(a.coding.language) || 0) + 1);
  });
  const avgTestsPassRate =
    codingAttempts.length > 0
      ? codingAttempts.reduce((sum, a) => {
          const total = a.coding?.testsTotal || 0;
          const passed = a.coding?.testsPassed || 0;
          return sum + (total > 0 ? passed / total : 0);
        }, 0) / codingAttempts.length
      : null;

  const shareSummary = [
    `📊 My Interview Booth progress`,
    profileName ? `${profileName} — ${submittedEmail}` : submittedEmail,
    `${attempts.length} interview${attempts.length === 1 ? "" : "s"} completed`,
    latestScore !== null ? `Latest score: ${toDisplayScore(latestScore)}/100` : null,
    bestScore !== null ? `Best score: ${toDisplayScore(bestScore)}/100` : null,
    streak && streak.current_streak > 0 ? `🔥 ${streak.current_streak}-day streak` : null,
    readinessScore !== null ? `Readiness Score: ${readinessScore}/100` : null,
  ]
    .filter(Boolean)
    .join("\n");

  async function copyShareSummary() {
    await navigator.clipboard.writeText(shareSummary);
    setShareCopied(true);
    setTimeout(() => setShareCopied(false), 2000);
  }

  return (
    <div className="flex min-h-screen" style={{ background: PAGE_GRADIENT }}>
      {/* ---------- SIDEBAR (sticky on desktop, slide-in drawer on mobile) ---------- */}
      <aside
        className={`fixed md:sticky top-0 left-0 h-screen z-40 bg-card border-r border-border flex flex-col shrink-0 transition-all duration-200 w-[232px] ${
          mobileNavOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"
        } ${collapsed ? "md:w-[72px]" : "md:w-[232px]"}`}
      >
        <div className="flex items-center justify-between px-4 py-4 border-b border-border shrink-0">
          {!collapsed && <span className="font-heading font-semibold text-sm">Dashboard</span>}
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
          <button
            type="button"
            onClick={() => {
              setActiveSection("profile");
              setMobileNavOpen(false);
            }}
            title="Profile"
            className={`w-full flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
              activeSection === "profile"
                ? "bg-accent text-accent-foreground"
                : "text-muted-foreground hover:bg-muted hover:text-foreground"
            }`}
          >
            <User className="h-4 w-4 shrink-0" />
            {!collapsed && <span className="truncate">Profile</span>}
          </button>
          <button
            type="button"
            onClick={switchEmail}
            title="Switch account"
            className="w-full flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
          >
            <LogOut className="h-4 w-4 shrink-0" />
            {!collapsed && <span className="truncate">Switch email</span>}
          </button>
        </div>
      </aside>

      {/* Mobile backdrop */}
      {mobileNavOpen && (
        <div
          className="fixed inset-0 bg-foreground/40 z-30 md:hidden"
          onClick={() => setMobileNavOpen(false)}
        />
      )}

      {/* ---------- MAIN CONTENT ---------- */}
      <div className="flex-1 min-w-0">
        {/* Mobile top bar */}
        <div className="md:hidden sticky top-0 z-20 flex items-center justify-between px-4 py-3 border-b border-border bg-background/95 backdrop-blur">
          <button type="button" onClick={() => setMobileNavOpen(true)} className="p-2 -ml-2 text-foreground">
            <Menu className="h-5 w-5" />
          </button>
          <span className="label-mono truncate">{activeLabel}</span>
          <span className="w-9" />
        </div>

        <div className="px-4 py-8 md:py-12 max-w-3xl mx-auto space-y-8">
          <div className="flex items-start justify-between flex-wrap gap-4">
            <div>
              <p className="label-mono mb-1">Mark sheet</p>
              <h1 className="text-3xl font-heading font-semibold">{activeLabel}</h1>
              <p className="text-muted-foreground mt-1">{submittedEmail}</p>
            </div>
          </div>

          {activeSection === "profile" ? (
            <Card>
              <CardHeader>
                <CardTitle>Profile</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center gap-4">
                  <div className="flex h-14 w-14 items-center justify-center rounded-full bg-accent text-accent-foreground shrink-0">
                    <User className="h-6 w-6" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-lg font-heading font-semibold text-foreground truncate">
                      {profileName || "No name on file"}
                    </p>
                    <p className="text-sm text-muted-foreground truncate">{submittedEmail}</p>
                  </div>
                </div>
                {!profileName && (
                  <p className="text-xs text-muted-foreground/70">
                    Your name will show up here automatically the next time you enter it while
                    starting a recruiter-shared interview.
                  </p>
                )}
              </CardContent>
            </Card>
          ) : attempts.length === 0 ? (
            <Card>
              <CardContent className="py-10 text-center space-y-4">
                <p className="text-muted-foreground">
                  No interviews found for this email yet. Once you complete a recruiter-shared interview,
                  it'll show up here.
                </p>
                <Button asChild>
                  <a href="/practice">
                    Take a practice interview
                    <ArrowRight className="h-4 w-4 ml-1.5" />
                  </a>
                </Button>
              </CardContent>
            </Card>
          ) : (
            <>
              {/* ---------- OVERVIEW ---------- */}
              {activeSection === "overview" && (
                <div className="space-y-4">
                  {/* Hero summary card */}
                  <Card className="overflow-hidden">
                    <CardContent className="pt-6">
                      <div className="flex flex-col sm:flex-row sm:items-center gap-5">
                        <div className="flex items-center gap-4 flex-1 min-w-0">
                          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-accent text-accent-foreground text-lg font-heading font-semibold shrink-0">
                            {initials || <User className="h-6 w-6" />}
                          </div>
                          <div className="min-w-0">
                            <p className="text-lg font-heading font-semibold text-foreground truncate">
                              {profileName || submittedEmail}
                            </p>
                            {streak && streak.current_streak > 0 && (
                              <p className="inline-flex items-center gap-1 text-sm text-seal mt-0.5">
                                <Flame className="h-3.5 w-3.5" />
                                {streak.current_streak} day{streak.current_streak === 1 ? "" : "s"} streak
                              </p>
                            )}
                          </div>
                        </div>

                        {readinessScore !== null && (
                          <div className="flex items-center gap-3 shrink-0">
                            <div className="text-right">
                              <p className="label-mono text-muted-foreground inline-flex items-center gap-1 justify-end">
                                <Gauge className="h-3 w-3" />
                                Readiness Score
                              </p>
                              <p className="text-3xl font-heading font-bold text-foreground">
                                {readinessScore}
                                <span className="text-muted-foreground text-base font-normal">/100</span>
                              </p>
                            </div>
                          </div>
                        )}
                      </div>

                      {nextMilestone && (
                        <div className="mt-5 pt-4 border-t border-border space-y-1.5">
                          <div className="flex items-center justify-between text-xs">
                            <span className="label-mono text-muted-foreground">
                              Next: {nextMilestone.label}
                            </span>
                            <span className="label-mono text-muted-foreground">
                              {nextMilestone.current}/{nextMilestone.target}
                            </span>
                          </div>
                          <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                            <div
                              className="h-full rounded-full bg-seal transition-all"
                              style={{ width: `${Math.min(100, (nextMilestone.current / nextMilestone.target) * 100)}%` }}
                            />
                          </div>
                        </div>
                      )}
                    </CardContent>
                  </Card>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {/* Platform comparison — backed by get_candidate_percentile() */}
                    <Card>
                      <CardHeader>
                        <CardTitle className="label-mono font-normal">Platform Comparison</CardTitle>
                      </CardHeader>
                      <CardContent>
                        {percentileAvailable === null && (
                          <p className="flex items-center gap-2 text-sm text-muted-foreground">
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            Checking...
                          </p>
                        )}
                        {percentileAvailable === true && percentile !== null && (
                          <p className="text-sm text-foreground">
                            Your best score beats <span className="font-semibold">{percentile}%</span> of the{" "}
                            {percentileSampleSize} other candidate{percentileSampleSize === 1 ? "" : "s"} on this
                            platform.
                          </p>
                        )}
                        {percentileAvailable === false && (
                          <p className="text-sm text-muted-foreground">
                            {percentileSampleSize > 0
                              ? `Only ${percentileSampleSize} other candidate${percentileSampleSize === 1 ? " has" : "s have"} scored sessions so far — check back once more people practice.`
                              : "Complete a scored interview to see how you compare to other candidates."}
                          </p>
                        )}
                      </CardContent>
                    </Card>

                    {/* Shareable progress card */}
                    <Card>
                      <CardHeader>
                        <CardTitle className="label-mono font-normal inline-flex items-center gap-1.5">
                          <Share2 className="h-3.5 w-3.5" />
                          Share Your Progress
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-2">
                        <p className="text-xs text-muted-foreground whitespace-pre-line font-mono bg-muted/50 rounded-md p-2.5">
                          {shareSummary}
                        </p>
                        <Button onClick={copyShareSummary} variant="outline" size="sm" className="w-full">
                          {shareCopied ? (
                            <>
                              <Check className="h-3.5 w-3.5 mr-1.5 text-verified" />
                              Copied!
                            </>
                          ) : (
                            <>
                              <Copy className="h-3.5 w-3.5 mr-1.5" />
                              Copy Summary
                            </>
                          )}
                        </Button>
                      </CardContent>
                    </Card>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
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
                    <Card>
                      <CardHeader>
                        <CardTitle className="label-mono font-normal">Best Score</CardTitle>
                      </CardHeader>
                      <CardContent>
                        {bestScore !== null ? (
                          <ScoreChip score={bestScore} />
                        ) : (
                          <p className="text-muted-foreground text-sm">—</p>
                        )}
                      </CardContent>
                    </Card>
                    <Card>
                      <CardHeader>
                        <CardTitle className="label-mono font-normal">Trend</CardTitle>
                      </CardHeader>
                      <CardContent className="flex items-center gap-3">
                        <Sparkline scores={scores} />
                        <TrendBadge trend={trend} />
                      </CardContent>
                    </Card>

                    {streak && (
                      <Card className="col-span-2 sm:col-span-4">
                        <CardHeader>
                          <CardTitle className="label-mono font-normal">Consistency</CardTitle>
                        </CardHeader>
                        <CardContent>
                          <StreakBadge streak={streak} />
                        </CardContent>
                      </Card>
                    )}
                  </div>
                </div>
              )}

              {/* ---------- INSIGHTS ---------- */}
              {activeSection === "insights" && (
                <div className="space-y-4">
                  <Card>
                    <CardHeader>
                      <CardTitle>Subject Strengths &amp; Weaknesses</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      {insightsLoading && (
                        <p className="flex items-center gap-2 text-sm text-muted-foreground">
                          <Loader2 className="h-4 w-4 animate-spin" />
                          Averaging your scores across every attempt...
                        </p>
                      )}
                      {insightsError && (
                        <p className="flex items-center gap-1.5 text-sm text-destructive">
                          <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                          {insightsError}
                        </p>
                      )}
                      {!insightsLoading && subjectAgg && subjectAgg.length === 0 && (
                        <p className="text-sm text-muted-foreground">
                          No subject-level scoring found across your attempts yet.
                        </p>
                      )}
                      {subjectAgg && subjectAgg.length > 0 && (
                        <>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-center">
                            <RadarChart subjects={subjectAgg} />
                            <SubjectProgressBars subjects={subjectAgg} />
                          </div>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                            {subjectAgg.map((s) => (
                              <SubjectStamp key={s.subject} subject={s.subject} average={s.average} />
                            ))}
                          </div>
                          {weakestSubject && (
                            <div className="rounded-lg border border-seal/40 bg-accent p-4 space-y-2.5">
                              <p className="text-sm text-accent-foreground">
                                <span className="font-semibold">{weakestSubject.subject}</span> is where you're
                                scoring lowest on average — worth focusing on next.
                              </p>
                              <div className="flex flex-wrap gap-2">
                                <Button asChild size="sm" variant="outline">
                                  <a href={`/career-chat?prompt=${encodeURIComponent(careerChatPrompt)}`}>
                                    <Sparkles className="h-3.5 w-3.5 mr-1.5" />
                                    Get tips in Career Chat
                                  </a>
                                </Button>
                                <Button asChild size="sm" variant="outline">
                                  <a href="/practice">
                                    Keep practicing
                                    <ArrowRight className="h-3.5 w-3.5 ml-1.5" />
                                  </a>
                                </Button>
                              </div>
                            </div>
                          )}
                        </>
                      )}
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader>
                      <CardTitle>Practice Pattern</CardTitle>
                    </CardHeader>
                    <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <p className="label-mono text-muted-foreground">Most active day</p>
                        <p className="text-lg font-heading font-semibold text-foreground">
                          {favoriteDay || "—"}
                        </p>
                      </div>
                      <div>
                        <p className="label-mono text-muted-foreground">Longest gap between attempts</p>
                        <p className="text-lg font-heading font-semibold text-foreground">
                          {longestGapDays !== null ? `${longestGapDays} day${longestGapDays === 1 ? "" : "s"}` : "—"}
                        </p>
                      </div>
                    </CardContent>
                  </Card>

                  {biggestJump && (
                    <Card>
                      <CardHeader>
                        <CardTitle>Biggest Improvement</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <p className="text-sm text-foreground">
                          Your score jumped from <ScoreChip score={biggestJump.from} /> to{" "}
                          <ScoreChip score={biggestJump.to} /> on{" "}
                          {new Date(biggestJump.date).toLocaleDateString()} — whatever you did differently,
                          keep doing it.
                        </p>
                      </CardContent>
                    </Card>
                  )}
                </div>
              )}

              {/* ---------- CONSISTENCY ---------- */}
              {activeSection === "consistency" && (
                <div className="space-y-4">
                  {streak && (
                    <Card>
                      <CardContent className="pt-6">
                        <StreakBadge streak={streak} />
                        <p className="label-mono text-muted-foreground/60 mt-2">
                          Longest streak: {streak.longest_streak} day{streak.longest_streak === 1 ? "" : "s"}
                        </p>
                      </CardContent>
                    </Card>
                  )}
                  <Card>
                    <CardHeader>
                      <CardTitle>Practice Calendar</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <ConsistencyCalendar attempts={attempts} />
                    </CardContent>
                  </Card>
                </div>
              )}

              {/* ---------- SCORE HISTORY ---------- */}
              {activeSection === "history" && (
                <div className="space-y-4">
                  <div className="grid grid-cols-3 gap-4">
                    <Card>
                      <CardHeader>
                        <CardTitle className="label-mono font-normal">Best</CardTitle>
                      </CardHeader>
                      <CardContent>{bestScore !== null && <ScoreChip score={bestScore} />}</CardContent>
                    </Card>
                    <Card>
                      <CardHeader>
                        <CardTitle className="label-mono font-normal">Latest</CardTitle>
                      </CardHeader>
                      <CardContent>{latestScore !== null && <ScoreChip score={latestScore} />}</CardContent>
                    </Card>
                    <Card>
                      <CardHeader>
                        <CardTitle className="label-mono font-normal">Lowest</CardTitle>
                      </CardHeader>
                      <CardContent>{worstScore !== null && <ScoreChip score={worstScore} />}</CardContent>
                    </Card>
                  </div>
                  {attempts.length >= 2 ? (
                    <Card>
                      <CardContent className="pt-6">
                        <ScoreHistoryChart attempts={attempts} />
                      </CardContent>
                    </Card>
                  ) : (
                    <Card>
                      <CardContent className="py-10 text-center text-muted-foreground">
                        Complete at least one more interview to see your score history chart.
                      </CardContent>
                    </Card>
                  )}
                  {scores.length > 0 && (
                    <Card>
                      <CardHeader>
                        <CardTitle>Score Distribution</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <ScoreHistogram scores={scores} />
                      </CardContent>
                    </Card>
                  )}
                </div>
              )}

              {/* ---------- CODING ----------
                  Now backed by real data: get_candidate_history() was
                  extended (20260823_add_coding_to_candidate_history.sql) to
                  LEFT JOIN LATERAL each session's most recent coding_sessions
                  row. The empty state below now only means "no coding rounds
                  completed yet" for THIS candidate, not "feature not built".
                  Session-timing still has no tracking anywhere in this
                  project, so that card stays a real placeholder. */}
              {activeSection === "coding" && (
                <div className="space-y-4">
                  <Card>
                    <CardHeader>
                      <CardTitle>Coding Performance</CardTitle>
                    </CardHeader>
                    <CardContent>
                      {codingAttempts.length === 0 ? (
                        <p className="text-sm text-muted-foreground">
                          No coding round data yet — complete a coding round in a recruiter-shared
                          interview and it'll show up here, with your language usage and test-pass rate.
                        </p>
                      ) : (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                          <div>
                            <p className="label-mono text-muted-foreground mb-2">Languages used</p>
                            <div className="space-y-1.5">
                              {Array.from(codingLanguages.entries()).map(([lang, count]) => (
                                <div key={lang} className="flex items-center justify-between text-sm">
                                  <span className="text-foreground">{lang}</span>
                                  <span className="label-mono text-muted-foreground">{count}</span>
                                </div>
                              ))}
                            </div>
                          </div>
                          <div>
                            <p className="label-mono text-muted-foreground mb-2">Avg. tests passed</p>
                            <p className="text-3xl font-heading font-bold text-foreground">
                              {avgTestsPassRate !== null ? `${Math.round(avgTestsPassRate * 100)}%` : "—"}
                            </p>
                          </div>
                        </div>
                      )}
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader>
                      <CardTitle className="inline-flex items-center gap-1.5">
                        <Clock className="h-4 w-4" />
                        Session Timing
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <p className="text-sm text-muted-foreground">
                        Not tracked yet — showing session duration or time-per-question needs timestamps
                        captured during the interview flow (e.g. when each question starts/ends), which
                        isn't currently stored. Flag this if you want it added.
                      </p>
                    </CardContent>
                  </Card>
                </div>
              )}

              {/* ---------- PAST ATTEMPTS ---------- */}
              {activeSection === "attempts" && (
                <Card>
                  <CardHeader>
                    <CardTitle>Past Attempts ({filteredAttempts.length}{filteredAttempts.length !== attempts.length ? ` of ${attempts.length}` : ""})</CardTitle>
                    <div className="flex flex-col sm:flex-row gap-2 pt-2">
                      <div className="relative flex-1">
                        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                        <Input
                          value={attemptSearch}
                          onChange={(e) => setAttemptSearch(e.target.value)}
                          placeholder="Search by interview title..."
                          className="pl-8"
                        />
                      </div>
                      <select
                        value={attemptSort}
                        onChange={(e) => setAttemptSort(e.target.value as typeof attemptSort)}
                        className="label-mono border border-border rounded-md px-2 py-1 bg-background transition-colors focus:outline-none focus:ring-2 focus:ring-ring/40"
                      >
                        <option value="newest">Newest first</option>
                        <option value="oldest">Oldest first</option>
                        <option value="highest">Highest score</option>
                        <option value="lowest">Lowest score</option>
                      </select>
                    </div>
                  </CardHeader>
                  <CardContent>
                    {filteredAttempts.length === 0 ? (
                      <p className="text-sm text-muted-foreground text-center py-6">
                        No attempts match &quot;{attemptSearch}&quot;.
                      </p>
                    ) : (
                    <div className="divide-y divide-border">
                      {filteredAttempts.map((a) => (
                        <div key={a.sessionId} className="py-4 space-y-1">
                          <div className="flex items-start justify-between gap-3 flex-wrap">
                            <div>
                              <p className="text-sm text-foreground">{a.interviewTitle}</p>
                              <p className="label-mono">{new Date(a.createdAt).toLocaleString()}</p>
                            </div>
                            {/* NOTE: assumes GET /api/session-report/[sessionId]?email=... returns
                                the PDF directly — this route exists in the project but its exact
                                signature wasn't available when this was written. Verify/adjust. */}
                            <a
                              href={`/api/session-report/${a.sessionId}?email=${encodeURIComponent(submittedEmail)}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1.5 label-mono text-muted-foreground hover:text-foreground transition-colors shrink-0"
                            >
                              <Download className="h-3.5 w-3.5" />
                              PDF Report
                            </a>
                          </div>
                          {a.overallScore !== null ? (
                            <span className="inline-flex items-center gap-2">
                              <ScoreChip score={a.overallScore} label="Q&A" />
                              <MiniScoreBar score={a.overallScore} />
                            </span>
                          ) : (
                            <span className="label-mono text-muted-foreground/60">Q&amp;A — not scored</span>
                          )}
                          <SessionBreakdown sessionId={a.sessionId} email={submittedEmail} />
                        </div>
                      ))}
                    </div>
                    )}
                  </CardContent>
                </Card>
              )}

              {/* ---------- ACHIEVEMENTS ---------- */}
              {activeSection === "achievements" && (
                <Card>
                  <CardHeader>
                    <CardTitle>Achievements</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <AchievementGrid achievements={achievements} />
                  </CardContent>
                </Card>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}