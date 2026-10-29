// TARGET PATH: app/create/page.tsx
"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useRequireAuth } from "@/lib/useAuth";
import {
  Loader2,
  AlertCircle,
  Copy,
  Check,
  Plus,
  RefreshCw,
  Trash2,
  ArrowLeft,
  ArrowRight,
  Sparkles,
} from "lucide-react";
import styles from "./page.module.css";

const CATEGORIES = ["CS Fundamentals", "DSA", "Project/Resume", "Behavioral"] as const;

const EXAMPLE_JDS = [
  {
    label: "Backend Engineer",
    text: "We're hiring a Backend Engineer to design and maintain REST APIs, work with PostgreSQL and Redis, and help scale our services. 2+ years of experience with Node.js or Python required. Familiarity with system design, caching strategies, and CI/CD pipelines is a strong plus. You'll collaborate closely with frontend and DevOps teams to ship reliable, well-tested features.",
  },
  {
    label: "Frontend Developer",
    text: "Looking for a Frontend Developer skilled in React and TypeScript to build responsive, accessible interfaces. You should be comfortable with component architecture, state management, and performance optimization. Experience with Next.js and Tailwind CSS is preferred. You'll work directly with designers to ship polished, production-ready user experiences.",
  },
  {
    label: "Data Analyst",
    text: "We need a Data Analyst who can write complex SQL queries, build dashboards in Power BI or Tableau, and communicate insights clearly to non-technical stakeholders. A strong understanding of statistics, A/B testing, and data cleaning is expected. Experience with Python (pandas) for exploratory analysis is a bonus.",
  },
];

const STAGE_ORDER = ["input", "review", "issued"] as const;
const STAGE_LABELS: Record<(typeof STAGE_ORDER)[number], string> = {
  input: "Paste JD",
  review: "Review Questions",
  issued: "Share Link",
};

interface QuestionDraft {
  id: string;
  category: string;
  question: string;
}

type Stage = "input" | "review" | "issued";


function StepIndicator({ stage }: { stage: Stage }) {
  const currentIndex = STAGE_ORDER.indexOf(stage);
  return (
    <div className="flex items-center justify-center gap-2 flex-wrap">
      {STAGE_ORDER.map((s, i) => {
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
                {isDone ? <Check className="h-3 w-3" /> : i + 1}
              </span>
              <span className="label-mono">{STAGE_LABELS[s]}</span>
            </div>
            {i < STAGE_ORDER.length - 1 && <span className="h-px w-6 bg-border shrink-0" />}
          </div>
        );
      })}
    </div>
  );
}

export default function CreateInterview() {
  const { session, loading: authLoading, logout } = useRequireAuth();

  const [stage, setStage] = useState<Stage>("input");
  const [jobDescription, setJobDescription] = useState("");
  const [questions, setQuestions] = useState<QuestionDraft[]>([]);
  const [interviewId, setInterviewId] = useState<string | null>(null);

  // Prefill from "Duplicate" on the recruiter dashboard — one-shot read,
  // cleared immediately so a page refresh doesn't keep re-prefilling.
  useEffect(() => {
    const duplicated = sessionStorage.getItem("duplicate_job_description");
    if (duplicated) {
      setJobDescription(duplicated);
      sessionStorage.removeItem("duplicate_job_description");
    }
  }, []);

  const [loading, setLoading] = useState(false);
  const [finalizing, setFinalizing] = useState(false);
  const [swappingId, setSwappingId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);

  const [newCategory, setNewCategory] = useState<string>(CATEGORIES[0]);
  const [newQuestionText, setNewQuestionText] = useState("");

  async function handleGeneratePreview() {
    setLoading(true);
    setError("");

    try {
      const res = await fetch("/api/preview-questions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session?.access_token}`,
        },
        body: JSON.stringify({ jobDescription }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Something went wrong.");
        return;
      }

      setQuestions(
        data.questions.map((q: { category: string; question: string }) => ({
          id: crypto.randomUUID(),
          category: q.category,
          question: q.question,
        }))
      );
      setStage("review");
    } catch (err) {
      setError("Failed to reach the server. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  function updateQuestionText(id: string, text: string) {
    setQuestions((prev) => prev.map((q) => (q.id === id ? { ...q, question: text } : q)));
  }

  function updateQuestionCategory(id: string, category: string) {
    setQuestions((prev) => prev.map((q) => (q.id === id ? { ...q, category } : q)));
  }

  function removeQuestion(id: string) {
    setQuestions((prev) => prev.filter((q) => q.id !== id));
  }

  function addQuestion() {
    if (!newQuestionText.trim()) return;
    setQuestions((prev) => [
      ...prev,
      { id: crypto.randomUUID(), category: newCategory, question: newQuestionText.trim() },
    ]);
    setNewQuestionText("");
  }

  async function swapQuestion(id: string) {
    const target = questions.find((q) => q.id === id);
    if (!target) return;

    setSwappingId(id);
    setError("");

    try {
      const res = await fetch("/api/swap-question", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session?.access_token}`,
        },
        body: JSON.stringify({
          jobDescription,
          category: target.category,
          existingQuestions: questions.map((q) => q.question),
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Failed to swap question.");
        return;
      }

      setQuestions((prev) =>
        prev.map((q) => (q.id === id ? { ...q, question: data.question } : q))
      );
    } catch (err) {
      setError("Failed to reach the server.");
    } finally {
      setSwappingId(null);
    }
  }

  async function handleFinalize() {
    if (questions.length === 0) {
      setError("Add at least one question before creating the interview.");
      return;
    }

    setFinalizing(true);
    setError("");

    try {
      const res = await fetch("/api/finalize-interview", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session?.access_token}`,
        },
        body: JSON.stringify({
          jobDescription,
          questions: questions.map(({ category, question }) => ({ category, question })),
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Something went wrong.");
        return;
      }

      setInterviewId(data.interviewId);
      setStage("issued");
    } catch (err) {
      setError("Failed to reach the server. Please try again.");
    } finally {
      setFinalizing(false);
    }
  }

  function getShareLink() {
    if (typeof window === "undefined" || !interviewId) return "";
    return `${window.location.origin}/interview/${interviewId}`;
  }

  async function copyLink() {
    await navigator.clipboard.writeText(getShareLink());
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  function restart() {
    setStage("input");
    setQuestions([]);
    setInterviewId(null);
    setJobDescription("");
    setError("");
    setNewQuestionText("");
  }

  const categoryCounts = CATEGORIES.map((c) => ({
    category: c,
    count: questions.filter((q) => q.category === c).length,
  })).filter((x) => x.count > 0);

  if (authLoading) {
    return (
      <main className="min-h-screen bg-background flex items-center justify-center">
        <p className="text-muted-foreground flex items-center gap-2">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading...
        </p>
      </main>
    );
  }

  return (
    <main className={`min-h-screen px-4 py-12 ${styles.pageBg}`}>
      <div className="mx-auto max-w-3xl space-y-8">
        <div className="text-center space-y-3">
          <p className="label-mono">Recruiter tools</p>
          <h1 className="text-3xl font-heading font-semibold">AI Interview Practice Booth</h1>
          <p className="text-muted-foreground">
            Paste a job description to generate a tailored interview
          </p>
          <div className="flex items-center justify-center gap-4 text-sm pt-1">
            <a href="/dashboard" className="text-seal hover:underline font-medium">
              View Dashboard →
            </a>
            <button
              onClick={logout}
              className="text-muted-foreground hover:text-foreground hover:underline transition-colors"
            >
              Log Out
            </button>
          </div>
          <div className="pt-3">
            <StepIndicator stage={stage} />
          </div>
        </div>

        {/* ---------- STAGE: input ---------- */}
        {stage === "input" && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5 items-start">
            <Card className="md:col-span-2">
              <CardHeader>
                <CardTitle>Job Description</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="label-mono text-muted-foreground/70">Try an example:</span>
                  {EXAMPLE_JDS.map((ex) => (
                    <button
                      key={ex.label}
                      type="button"
                      onClick={() => setJobDescription(ex.text)}
                      className="text-xs font-medium border border-border rounded-full px-3 py-1.5 text-foreground hover:border-foreground/30 hover:bg-muted transition-colors"
                    >
                      {ex.label}
                    </button>
                  ))}
                </div>
                <Textarea
                  placeholder="Paste the job description here..."
                  value={jobDescription}
                  onChange={(e) => setJobDescription(e.target.value)}
                  rows={8}
                />
                <Button
                  onClick={handleGeneratePreview}
                  disabled={loading || jobDescription.trim().length < 20}
                  className="w-full"
                >
                  {loading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                  {loading ? "Generating questions..." : "Generate Interview Questions"}
                </Button>
                {error && (
                  <p className="flex items-center justify-center gap-1.5 text-sm text-destructive text-center">
                    <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                    {error}
                  </p>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <p className="label-mono text-seal mb-1">How it works</p>
                <CardTitle className="text-base">What happens next</CardTitle>
              </CardHeader>
              <CardContent>
                <ol className="space-y-3 text-sm text-muted-foreground">
                  <li className="flex gap-2.5">
                    <span className="shrink-0 flex h-5 w-5 items-center justify-center rounded-full bg-accent text-accent-foreground text-[0.65rem] font-semibold">1</span>
                    Paste a job description — longer, detailed ones (100+ words) generate more relevant questions.
                  </li>
                  <li className="flex gap-2.5">
                    <span className="shrink-0 flex h-5 w-5 items-center justify-center rounded-full bg-accent text-accent-foreground text-[0.65rem] font-semibold">2</span>
                    We generate questions across CS Fundamentals, DSA, Project/Resume, and Behavioral.
                  </li>
                  <li className="flex gap-2.5">
                    <span className="shrink-0 flex h-5 w-5 items-center justify-center rounded-full bg-accent text-accent-foreground text-[0.65rem] font-semibold">3</span>
                    Edit the wording, swap any question, or add your own before sharing.
                  </li>
                  <li className="flex gap-2.5">
                    <span className="shrink-0 flex h-5 w-5 items-center justify-center rounded-full bg-accent text-accent-foreground text-[0.65rem] font-semibold">4</span>
                    Get a link — the candidate's scored results land on your dashboard automatically.
                  </li>
                </ol>
              </CardContent>
            </Card>
          </div>
        )}

        {/* ---------- STAGE: review (edit / add / swap / remove) ---------- */}
        {stage === "review" && (
          <>
            <Card>
              <CardHeader className="space-y-2">
                <p className="label-mono mb-1">Not shared yet</p>
                <CardTitle>Review &amp; Customize Questions ({questions.length})</CardTitle>
                {categoryCounts.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    {categoryCounts.map(({ category, count }) => (
                      <Badge key={category} variant="secondary" className="text-xs font-mono">
                        {category} · {count}
                      </Badge>
                    ))}
                  </div>
                )}
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-sm text-muted-foreground">
                  Edit the wording, swap a question for a fresh AI-generated one,
                  remove anything you don't want, or add your own. Nothing is
                  shared with a candidate until you create the interview below.
                </p>

                {questions.length === 0 && (
                  <p className="text-sm text-muted-foreground/70 text-center py-6">
                    No questions left — add at least one below to continue.
                  </p>
                )}

                <div className="space-y-3">
                  {questions.map((q) => (
                    <div key={q.id} className="border border-border rounded-lg p-4 space-y-2">
                      <div className="flex items-center justify-between gap-2">
                        <select
                          value={q.category}
                          onChange={(e) => updateQuestionCategory(q.id, e.target.value)}
                          className="label-mono border border-border rounded px-2 py-1 bg-background transition-colors focus:outline-none focus:ring-2 focus:ring-ring/40"
                        >
                          {CATEGORIES.map((c) => (
                            <option key={c} value={c}>
                              {c}
                            </option>
                          ))}
                        </select>
                        <div className="flex items-center gap-1 shrink-0">
                          <button
                            type="button"
                            onClick={() => swapQuestion(q.id)}
                            disabled={swappingId === q.id}
                            title="Swap for a different AI-generated question"
                            className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors disabled:opacity-50"
                          >
                            {swappingId === q.id ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <RefreshCw className="h-4 w-4" />
                            )}
                          </button>
                          <button
                            type="button"
                            onClick={() => removeQuestion(q.id)}
                            title="Remove this question"
                            className="p-1.5 rounded-md text-muted-foreground hover:text-destructive hover:bg-muted transition-colors"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </div>
                      <Textarea
                        value={q.question}
                        onChange={(e) => updateQuestionText(q.id, e.target.value)}
                        rows={2}
                      />
                    </div>
                  ))}
                </div>

                {/* Add your own question */}
                <div className="border border-dashed border-border rounded-lg p-4 space-y-2">
                  <p className="label-mono">Add your own question</p>
                  <select
                    value={newCategory}
                    onChange={(e) => setNewCategory(e.target.value)}
                    className="label-mono border border-border rounded px-2 py-1 bg-background transition-colors focus:outline-none focus:ring-2 focus:ring-ring/40"
                  >
                    {CATEGORIES.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                  <Textarea
                    value={newQuestionText}
                    onChange={(e) => setNewQuestionText(e.target.value)}
                    placeholder="Type your custom question..."
                    rows={2}
                  />
                  <Button
                    variant="outline"
                    onClick={addQuestion}
                    disabled={!newQuestionText.trim()}
                    className="w-full"
                  >
                    <Plus className="h-4 w-4 mr-1.5" />
                    Add Question
                  </Button>
                </div>

                {error && (
                  <p className="flex items-center justify-center gap-1.5 text-sm text-destructive text-center">
                    <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                    {error}
                  </p>
                )}

                <div className="flex gap-3 pt-2">
                  <Button variant="outline" onClick={() => setStage("input")} className="flex-1">
                    <ArrowLeft className="h-4 w-4 mr-1.5" />
                    Back
                  </Button>
                  <Button
                    onClick={handleFinalize}
                    disabled={finalizing || questions.length === 0}
                    className="flex-1"
                  >
                    {finalizing && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                    {finalizing ? "Creating..." : "Create Interview & Get Link"}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </>
        )}

        {/* ---------- STAGE: issued ---------- */}
        {stage === "issued" && interviewId && (
          <>
            <Card className="overflow-hidden pt-0">
              <div className="h-1.5 w-full" style={{ background: "linear-gradient(90deg, #a3ec5c, #6fe0c0)" }} />
              <CardHeader>
                <p className="label-mono mb-1 flex items-center gap-1.5 text-verified">
                  <Sparkles className="h-3 w-3" />
                  Interview created
                </p>
                <CardTitle>Shareable Interview Link</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-sm text-muted-foreground">
                  Send this link to a candidate — they'll take the interview and
                  their scored results will show up on your dashboard.
                </p>
                <div className="flex gap-2">
                  <input
                    readOnly
                    value={getShareLink()}
                    onFocus={(e) => e.currentTarget.select()}
                    className="flex-1 rounded-md border border-border bg-muted px-3 py-2 text-sm text-foreground font-mono transition-colors focus:outline-none focus:ring-2 focus:ring-ring/40"
                  />
                  <Button onClick={copyLink} variant="outline" className="shrink-0">
                    {copied ? (
                      <>
                        <Check className="h-4 w-4 mr-1.5 text-verified" />
                        Copied!
                      </>
                    ) : (
                      <>
                        <Copy className="h-4 w-4 mr-1.5" />
                        Copy
                      </>
                    )}
                  </Button>
                </div>

                <div className="space-y-2 pt-2 border-t border-border">
                  <p className="flex items-center gap-2 text-sm text-verified pt-3">
                    <Check className="h-4 w-4 shrink-0" />
                    Interview created and ready to share
                  </p>
                  <p className="flex items-center gap-2 text-sm text-muted-foreground">
                    <ArrowRight className="h-4 w-4 shrink-0" />
                    Share the link above with your candidate
                  </p>
                  <p className="flex items-center gap-2 text-sm text-muted-foreground">
                    <ArrowRight className="h-4 w-4 shrink-0" />
                    Scored results will appear on your dashboard automatically
                  </p>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Final Questions ({questions.length})</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {questions.map((q) => (
                  <div
                    key={q.id}
                    className="border-b border-border pb-4 last:border-none last:pb-0"
                  >
                    <Badge variant="secondary" className="mb-2 font-mono text-xs">
                      {q.category}
                    </Badge>
                    <p className="text-foreground">{q.question}</p>
                  </div>
                ))}
              </CardContent>
            </Card>

            <Button onClick={restart} className="w-full" variant="outline">
              <Plus className="h-4 w-4 mr-1.5" />
              Create Another Interview
            </Button>
          </>
        )}
      </div>
    </main>
  );
}