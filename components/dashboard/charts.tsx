// TARGET PATH: components/dashboard/charts.tsx
"use client";

import { TrendingUp, TrendingDown, Minus, Flame } from "lucide-react";
import { toDisplayScore } from "@/lib/scoring";

// Extracted from app/dashboard/page.tsx (recruiter dashboard) so the
// candidate dashboard can render identical visuals instead of a second,
// slowly-drifting copy. Behavior is unchanged from the original —
// this is a pure move, not a rewrite.

export interface CodingSummary {
  aiScore: number | null;
  testsPassed: number | null;
  testsTotal: number | null;
  language: string | null;
}

export interface CandidateAttempt {
  sessionId: string;
  interviewId: string;
  interviewTitle: string;
  overallScore: number | null;
  createdAt: string;
  coding: CodingSummary | null;
}

export interface SubjectScore {
  subject: string;
  average: number;
  count: number;
}

export interface SessionDetail {
  overallScore: number | null;
  overallFeedback: string | null;
  subjects: SubjectScore[];
  strengths: string[];
  improvements: string[];
  coding: {
    questionTitle: string | null;
    aiScore: number | null;
    testsPassed: number | null;
    testsTotal: number | null;
    language: string | null;
    aiFeedback: string | null;
  } | null;
}

export type Trend = "up" | "down" | "flat" | "insufficient";

// Shape returned by the get_candidate_streak() SECURITY DEFINER function.
export interface StreakData {
  current_streak: number;
  longest_streak: number;
  days_this_week: number;
}

export function scoreColor(score: number) {
  if (score >= 7) return "text-verified";
  if (score >= 4) return "text-seal";
  return "text-destructive";
}

export function ScoreChip({ score, label }: { score: number; label?: string }) {
  return (
    <span className="inline-flex items-center gap-1">
      {label && <span className="label-mono text-muted-foreground">{label}</span>}
      <span className={`font-mono text-sm font-medium ${scoreColor(score)}`}>
        {toDisplayScore(score)}
        <span className="text-muted-foreground text-xs"> /100</span>
      </span>
    </span>
  );
}

// Minimal inline sparkline — no charting library, just a polyline over
// scores oldest to newest (left to right).
export function Sparkline({ scores }: { scores: number[] }) {
  if (scores.length < 2) return null;
  const width = 96;
  const height = 28;
  const pad = 3;
  const min = Math.min(...scores);
  const max = Math.max(...scores);
  const range = max - min || 1;

  const points = scores
    .map((s, i) => {
      const x = (i / (scores.length - 1)) * (width - pad * 2) + pad;
      const y = height - pad - ((s - min) / range) * (height - pad * 2);
      return `${x},${y}`;
    })
    .join(" ");

  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} className="shrink-0">
      <polyline
        points={points}
        fill="none"
        stroke="currentColor"
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
        className="text-muted-foreground"
      />
    </svg>
  );
}

// Full score-history chart — plots Q&A and coding scores (when present) on
// a fixed 0–10 scale so improvement is judged against the real range, not
// an auto-scaled sliver of it. currentColor + Tailwind classes throughout
// so it follows dark mode like everything else.
export function ScoreHistoryChart({ attempts }: { attempts: CandidateAttempt[] }) {
  const width = 600;
  const height = 160;
  const padLeft = 26;
  const padRight = 8;
  const padTop = 10;
  const padBottom = 22;
  const plotWidth = width - padLeft - padRight;
  const plotHeight = height - padTop - padBottom;
  const n = attempts.length;

  const xFor = (i: number) => padLeft + (n === 1 ? plotWidth / 2 : (i / (n - 1)) * plotWidth);
  const yFor = (score: number) =>
    padTop + plotHeight - (Math.max(0, Math.min(10, score)) / 10) * plotHeight;

  const qaPoints = attempts.map((a, i) =>
    a.overallScore !== null
      ? { x: xFor(i), y: yFor(a.overallScore), score: a.overallScore, date: a.createdAt }
      : null
  );
  const codingPoints = attempts.map((a, i) =>
    a.coding && a.coding.aiScore !== null
      ? { x: xFor(i), y: yFor(a.coding.aiScore as number), score: a.coding.aiScore as number, date: a.createdAt }
      : null
  );

  const qaLine = qaPoints
    .filter((p): p is NonNullable<typeof p> => p !== null)
    .map((p) => `${p.x},${p.y}`)
    .join(" ");
  const codingLine = codingPoints
    .filter((p): p is NonNullable<typeof p> => p !== null)
    .map((p) => `${p.x},${p.y}`)
    .join(" ");
  const hasCoding = codingPoints.some((p) => p !== null);
  const showAllLabels = n <= 8;

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <p className="label-mono">Score history</p>
        <div className="flex items-center gap-3 label-mono text-muted-foreground/70">
          <span className="inline-flex items-center gap-1.5">
            <span className="w-2 h-0.5 bg-seal inline-block" />
            Q&amp;A
          </span>
          {hasCoding && (
            <span className="inline-flex items-center gap-1.5">
              <span className="w-2 border-t border-dashed border-muted-foreground inline-block" />
              Coding
            </span>
          )}
        </div>
      </div>

      <svg viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none" className="w-full h-40 font-mono">
        {[0, 5, 10].map((v) => (
          <g key={v}>
            <line
              x1={padLeft}
              x2={width - padRight}
              y1={yFor(v)}
              y2={yFor(v)}
              stroke="currentColor"
              strokeWidth={1}
              className="text-border"
            />
            <text x={0} y={yFor(v) + 3} fontSize={9} className="fill-muted-foreground">
              {toDisplayScore(v)}
            </text>
          </g>
        ))}

        {codingLine && (
          <polyline
            points={codingLine}
            fill="none"
            strokeWidth={1.5}
            strokeDasharray="4 3"
            stroke="currentColor"
            className="text-muted-foreground"
          />
        )}
        {qaLine && (
          <polyline points={qaLine} fill="none" strokeWidth={2} stroke="currentColor" className="text-seal" />
        )}

        {qaPoints.map(
          (p, i) =>
            p && (
              <circle key={`qa-${i}`} cx={p.x} cy={p.y} r={3.5} fill="currentColor" className={scoreColor(p.score)}>
                <title>{`${new Date(p.date).toLocaleDateString()} — Q&A ${toDisplayScore(p.score)}/100`}</title>
              </circle>
            )
        )}
        {codingPoints.map(
          (p, i) =>
            p && (
              <circle
                key={`coding-${i}`}
                cx={p.x}
                cy={p.y}
                r={3}
                fill="none"
                strokeWidth={1.5}
                stroke="currentColor"
                className={scoreColor(p.score)}
              >
                <title>{`${new Date(p.date).toLocaleDateString()} — Coding ${toDisplayScore(p.score)}/100`}</title>
              </circle>
            )
        )}

        {attempts.map((a, i) => {
          if (!showAllLabels && i !== 0 && i !== n - 1) return null;
          return (
            <text
              key={i}
              x={xFor(i)}
              y={height - 6}
              fontSize={8}
              textAnchor="middle"
              className="fill-muted-foreground"
            >
              {new Date(a.createdAt).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
            </text>
          );
        })}
      </svg>
    </div>
  );
}

export function TrendBadge({ trend }: { trend: Trend }) {
  if (trend === "insufficient") {
    return <span className="label-mono text-muted-foreground/60">First attempt</span>;
  }
  const config = {
    up: { Icon: TrendingUp, className: "text-verified", label: "Improving" },
    down: { Icon: TrendingDown, className: "text-destructive", label: "Declining" },
    flat: { Icon: Minus, className: "text-muted-foreground", label: "Steady" },
  }[trend];
  const { Icon, className, label } = config;
  return (
    <span className={`inline-flex items-center gap-1 label-mono ${className}`}>
      <Icon className="h-3.5 w-3.5" />
      {label}
    </span>
  );
}

// "Practiced N days this week" pill, with a flame + current streak when
// there's an active one. Matches TrendBadge's label-mono sizing so the two
// sit comfortably side by side in the stats grid.
export function StreakBadge({ streak }: { streak: StreakData }) {
  const { current_streak, days_this_week } = streak;

  if (days_this_week === 0 && current_streak === 0) {
    return <span className="label-mono text-muted-foreground/60">No sessions yet this week</span>;
  }

  return (
    <span className="inline-flex items-center gap-3">
      <span className="inline-flex items-center gap-1 label-mono">
        {current_streak > 0 && <Flame className="h-3.5 w-3.5 text-seal" />}
        <span className={current_streak > 0 ? "text-seal" : "text-muted-foreground"}>
          {current_streak > 0
            ? `${current_streak} day${current_streak === 1 ? "" : "s"} streak`
            : "No active streak"}
        </span>
      </span>
      <span className="label-mono text-muted-foreground">
        {days_this_week} day{days_this_week === 1 ? "" : "s"} this week
      </span>
    </span>
  );
}

// A single subject's marks, styled like a report-card line item.
export function SubjectStamp({ subject, average }: { subject: string; average: number }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-md border border-border px-3 py-1.5">
      <span className="label-mono">{subject}</span>
      <span className={`font-mono text-sm font-medium ${scoreColor(average)}`}>
        {toDisplayScore(average)}
        <span className="text-muted-foreground text-xs"> /100</span>
      </span>
    </div>
  );
}

// Opacity steps for the donut ring — single hue (seal gold) shaded from
// solid to faint, reads as a wax-seal rosette rather than a rainbow pie.
const DONUT_OPACITY_STEPS = [1, 0.72, 0.5, 0.34, 0.22];

// Marks-split donut: each slice's size is that subject's share of the
// attempt's total marks. Hole in the middle carries the attempt's average.
export function SubjectDonut({ subjects }: { subjects: SubjectScore[] }) {
  const size = 132;
  const r = 48;
  const strokeWidth = 15;
  const cx = size / 2;
  const cy = size / 2;
  const circumference = 2 * Math.PI * r;

  const total = subjects.reduce((sum, s) => sum + Math.max(0, s.average), 0);

  if (total <= 0) {
    return (
      <div
        className="flex items-center justify-center rounded-full border border-dashed border-border shrink-0"
        style={{ width: size, height: size }}
      >
        <p className="label-mono text-muted-foreground/60 text-center leading-tight">
          No marks
          <br />
          to chart
        </p>
      </div>
    );
  }

  const meanAverage = Math.round((total / subjects.length) * 10) / 10;
  let cumulative = 0;

  return (
    <div className="flex items-center gap-4">
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="shrink-0">
        <circle cx={cx} cy={cy} r={r} fill="none" stroke="currentColor" strokeWidth={strokeWidth} className="text-border" />
        <g transform={`rotate(-90 ${cx} ${cy})`}>
          {subjects.map((s, i) => {
            const proportion = Math.max(0, s.average) / total;
            const dash = proportion * circumference;
            const offset = cumulative * circumference;
            cumulative += proportion;
            return (
              <circle
                key={s.subject}
                cx={cx}
                cy={cy}
                r={r}
                fill="none"
                stroke="currentColor"
                strokeWidth={strokeWidth}
                strokeDasharray={`${dash} ${circumference - dash}`}
                strokeDashoffset={-offset}
                className="text-seal"
                style={{ opacity: DONUT_OPACITY_STEPS[i % DONUT_OPACITY_STEPS.length] }}
              >
                <title>{`${s.subject}: ${toDisplayScore(s.average)}/100 · ${Math.round(proportion * 100)}% of marks`}</title>
              </circle>
            );
          })}
        </g>
        <text x={cx} y={cy - 3} textAnchor="middle" fontSize={12} className="fill-foreground font-mono font-medium">
          {toDisplayScore(meanAverage)}
        </text>
        <text x={cx} y={cy + 12} textAnchor="middle" fontSize={7} className="fill-muted-foreground font-mono">
          AVG /100
        </text>
      </svg>

      <div className="space-y-1.5">
        {subjects.map((s, i) => (
          <div key={s.subject} className="flex items-center gap-2">
            <span
              className="w-2.5 h-2.5 rounded-sm inline-block text-seal shrink-0"
              style={{ opacity: DONUT_OPACITY_STEPS[i % DONUT_OPACITY_STEPS.length], backgroundColor: "currentColor" }}
            />
            <span className="text-sm text-foreground">{s.subject}</span>
            <span className="label-mono text-muted-foreground/70">
              {Math.round((Math.max(0, s.average) / total) * 100)}%
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

// GitHub-style practice calendar — built entirely client-side from each
// attempt's createdAt timestamp, no new API needed. Shows the last 10 weeks;
// darker squares mean more attempts logged that day.
export function ConsistencyCalendar({ attempts }: { attempts: CandidateAttempt[] }) {
  const dayCounts = new Map<string, number>();
  attempts.forEach((a) => {
    const key = new Date(a.createdAt).toDateString();
    dayCounts.set(key, (dayCounts.get(key) || 0) + 1);
  });

  const totalDays = 70; // 10 weeks
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const days: { date: Date; count: number }[] = [];
  for (let i = totalDays - 1; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    days.push({ date: d, count: dayCounts.get(d.toDateString()) || 0 });
  }

  const weeks: { date: Date; count: number }[][] = [];
  for (let i = 0; i < days.length; i += 7) {
    weeks.push(days.slice(i, i + 7));
  }

  function levelClass(count: number) {
    if (count === 0) return "bg-muted";
    if (count === 1) return "bg-seal/40";
    if (count === 2) return "bg-seal/70";
    return "bg-seal";
  }

  return (
    <div className="space-y-2.5">
      <div className="flex gap-1 overflow-x-auto pb-1">
        {weeks.map((week, wi) => (
          <div key={wi} className="flex flex-col gap-1 shrink-0">
            {week.map((day, di) => (
              <div
                key={di}
                title={`${day.date.toLocaleDateString()} — ${day.count} attempt${day.count === 1 ? "" : "s"}`}
                className={`w-3 h-3 rounded-sm ${levelClass(day.count)}`}
              />
            ))}
          </div>
        ))}
      </div>
      <div className="flex items-center gap-1.5 label-mono text-muted-foreground/60">
        <span>Less</span>
        <span className="w-3 h-3 rounded-sm bg-muted inline-block" />
        <span className="w-3 h-3 rounded-sm bg-seal/40 inline-block" />
        <span className="w-3 h-3 rounded-sm bg-seal/70 inline-block" />
        <span className="w-3 h-3 rounded-sm bg-seal inline-block" />
        <span>More</span>
      </div>
    </div>
  );
}

export interface Achievement {
  label: string;
  description: string;
  achieved: boolean;
}

// Milestone badges — purely derived from data the page already has
// (attempt count, streak, best score). No fabricated claims, just simple
// thresholds on real numbers.
export function AchievementGrid({ achievements }: { achievements: Achievement[] }) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
      {achievements.map((a) => (
        <div
          key={a.label}
          className={`rounded-lg border p-3.5 text-center space-y-1 transition-colors ${
            a.achieved ? "border-seal bg-accent" : "border-border bg-muted/30 opacity-60"
          }`}
        >
          <p className={`text-sm font-semibold ${a.achieved ? "text-accent-foreground" : "text-muted-foreground"}`}>
            {a.label}
          </p>
          <p className="text-xs text-muted-foreground">{a.description}</p>
        </div>
      ))}
    </div>
  );
}

// Skill radar — up to ~6 subjects plotted as a polygon on concentric rings.
// Falls back to a message rather than a distorted 1- or 2-point shape when
// there isn't enough subject variety to make a meaningful polygon.
export function RadarChart({ subjects }: { subjects: SubjectScore[] }) {
  if (subjects.length < 3) {
    return (
      <p className="text-sm text-muted-foreground text-center py-8">
        Need at least 3 distinct subjects scored to draw a radar chart — keep practicing across
        different question types to unlock this.
      </p>
    );
  }

  const size = 220;
  const cx = size / 2;
  const cy = size / 2;
  const maxR = 84;
  const n = subjects.length;
  const angleFor = (i: number) => (Math.PI * 2 * i) / n - Math.PI / 2;

  // subjects.average is on the same 0–10 scale used elsewhere (scoreColor,
  // ScoreHistoryChart's 0–10 axis) — clamp defensively.
  const pointFor = (i: number, value: number) => {
    const r = (Math.max(0, Math.min(10, value)) / 10) * maxR;
    const angle = angleFor(i);
    return { x: cx + r * Math.cos(angle), y: cy + r * Math.sin(angle) };
  };

  const polygonPoints = subjects.map((s, i) => pointFor(i, s.average)).map((p) => `${p.x},${p.y}`).join(" ");
  const ringLevels = [0.25, 0.5, 0.75, 1];

  return (
    <div className="flex flex-col items-center gap-3">
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        {ringLevels.map((level) => {
          const ringPoints = subjects
            .map((_, i) => {
              const angle = angleFor(i);
              const r = maxR * level;
              return `${cx + r * Math.cos(angle)},${cy + r * Math.sin(angle)}`;
            })
            .join(" ");
          return (
            <polygon
              key={level}
              points={ringPoints}
              fill="none"
              stroke="currentColor"
              strokeWidth={1}
              className="text-border"
            />
          );
        })}
        {subjects.map((_, i) => {
          const angle = angleFor(i);
          return (
            <line
              key={i}
              x1={cx}
              y1={cy}
              x2={cx + maxR * Math.cos(angle)}
              y2={cy + maxR * Math.sin(angle)}
              stroke="currentColor"
              strokeWidth={1}
              className="text-border"
            />
          );
        })}
        <polygon points={polygonPoints} fill="currentColor" fillOpacity={0.18} stroke="currentColor" strokeWidth={2} className="text-seal" />
        {subjects.map((s, i) => {
          const p = pointFor(i, s.average);
          return <circle key={s.subject} cx={p.x} cy={p.y} r={3} fill="currentColor" className="text-seal" />;
        })}
        {subjects.map((s, i) => {
          const angle = angleFor(i);
          const labelR = maxR + 22;
          const x = cx + labelR * Math.cos(angle);
          const y = cy + labelR * Math.sin(angle);
          return (
            <text
              key={s.subject}
              x={x}
              y={y}
              textAnchor="middle"
              dominantBaseline="middle"
              fontSize={9}
              className="fill-muted-foreground"
            >
              {s.subject.length > 14 ? `${s.subject.slice(0, 12)}…` : s.subject}
            </text>
          );
        })}
      </svg>
    </div>
  );
}

// Horizontal bars per subject — same subjectAgg data as RadarChart and
// SubjectStamp, just a more scannable list layout.
export function SubjectProgressBars({ subjects }: { subjects: SubjectScore[] }) {
  return (
    <div className="space-y-3">
      {subjects.map((s) => {
        const pct = (Math.max(0, Math.min(10, s.average)) / 10) * 100;
        return (
          <div key={s.subject} className="space-y-1">
            <div className="flex items-center justify-between text-sm">
              <span className="text-foreground">{s.subject}</span>
              <span className={`font-mono text-xs font-medium ${scoreColor(s.average)}`}>
                {toDisplayScore(s.average)}/100
              </span>
            </div>
            <div className="h-2 rounded-full bg-muted overflow-hidden">
              <div className="h-full rounded-full bg-seal" style={{ width: `${pct}%` }} />
            </div>
          </div>
        );
      })}
    </div>
  );
}

// Score distribution histogram — five fixed bands on the 0–100 display
// scale, so the shape is comparable across candidates regardless of how
// many attempts they have.
export function ScoreHistogram({ scores }: { scores: number[] }) {
  if (scores.length === 0) return null;
  const bands = [
    { label: "0–20", min: 0, max: 20 },
    { label: "20–40", min: 20, max: 40 },
    { label: "40–60", min: 40, max: 60 },
    { label: "60–80", min: 60, max: 80 },
    { label: "80–100", min: 80, max: 101 },
  ];
  const displayScores = scores.map((s) => toDisplayScore(s));
  const counts = bands.map((b) => displayScores.filter((s) => s >= b.min && s < b.max).length);
  const maxCount = Math.max(...counts, 1);

  return (
    <div className="flex items-end gap-3 h-32">
      {bands.map((b, i) => (
        <div key={b.label} className="flex-1 flex flex-col items-center gap-1.5 h-full justify-end">
          <span className="label-mono text-muted-foreground/70">{counts[i]}</span>
          <div
            className="w-full rounded-t-md bg-seal transition-all"
            style={{ height: `${(counts[i] / maxCount) * 100}%`, minHeight: counts[i] > 0 ? 4 : 0 }}
          />
          <span className="label-mono text-muted-foreground/60">{b.label}</span>
        </div>
      ))}
    </div>
  );
}

// Compact inline bar for list rows (Past Attempts) — same scale/coloring
// language as SubjectProgressBars, sized for a single-line row.
export function MiniScoreBar({ score }: { score: number }) {
  const pct = (Math.max(0, Math.min(10, score)) / 10) * 100;
  return (
    <div className="h-1.5 w-20 rounded-full bg-muted overflow-hidden shrink-0">
      <div className={`h-full rounded-full ${scoreColor(score).replace("text-", "bg-")}`} style={{ width: `${pct}%` }} />
    </div>
  );
}