// TARGET PATH: app/create/page.tsx
"use client";

import { useState } from "react";
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
} from "lucide-react";

const CATEGORIES = ["CS Fundamentals", "DSA", "Project/Resume", "Behavioral"] as const;

interface QuestionDraft {
  id: string;
  category: string;
  question: string;
}

type Stage = "input" | "review" | "issued";

export default function CreateInterview() {
  const { session, loading: authLoading, logout } = useRequireAuth();

  const [stage, setStage] = useState<Stage>("input");
  const [jobDescription, setJobDescription] = useState("");
  const [questions, setQuestions] = useState<QuestionDraft[]>([]);
  const [interviewId, setInterviewId] = useState<string | null>(null);

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
    <main className="min-h-screen bg-background px-4 py-12">
      <div className="mx-auto max-w-3xl space-y-8">
        <div className="text-center space-y-2">
          <p className="label-mono">Recruiter tools</p>
          <h1 className="text-3xl">AI Interview Practice Booth</h1>
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
        </div>

        {/* ---------- STAGE: input ---------- */}
        {stage === "input" && (
          <Card>
            <CardHeader>
              <CardTitle>Job Description</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
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
        )}

        {/* ---------- STAGE: review (edit / add / swap / remove) ---------- */}
        {stage === "review" && (
          <>
            <Card>
              <CardHeader>
                <p className="label-mono mb-1">Not shared yet</p>
                <CardTitle>Review &amp; Customize Questions ({questions.length})</CardTitle>
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
            {/* Shareable link styled as the issued hall ticket */}
            <Card className="overflow-hidden pt-0">
              <div className="flex gap-1.5 px-6 pt-4 pb-2">
                {Array.from({ length: 8 }).map((_, i) => (
                  <div
                    key={i}
                    className="w-1.5 h-1.5 rounded-full bg-background border border-border"
                  />
                ))}
              </div>
              <CardHeader>
                <p className="label-mono mb-1">Candidate ticket issued</p>
                <CardTitle>Shareable Interview Link</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
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
                <div className="flex justify-center gap-0.5 pt-2 opacity-40">
                  {[2, 1, 3, 1, 2, 1, 1, 3, 2, 1, 2, 1, 3, 1, 2, 1, 2].map((w, i) => (
                    <div
                      key={i}
                      style={{ width: `${w}px`, height: "16px" }}
                      className="bg-foreground"
                    />
                  ))}
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