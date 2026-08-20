// TARGET PATH: app/interview/[id]/coding/page.tsx
"use client";

import { useState, useEffect, Suspense } from "react";
import { useParams, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

interface TestCase {
  input: string;
  expectedOutput: string;
}

interface CodingQuestion {
  id: string;
  title: string;
  prompt: string;
  starter_code: Record<string, string>;
  test_cases: TestCase[];
}

interface TestResult {
  input: string;
  expectedOutput: string;
  actualOutput: string;
  stderr: string;
  passed: boolean;
}

type Stage = "loading" | "ready" | "notfound" | "done";
type Language = "javascript" | "python" | "java" | "cpp";

const LANGUAGE_LABELS: Record<Language, string> = {
  javascript: "JavaScript",
  python: "Python",
  java: "Java",
  cpp: "C++",
};

function scoreColor(score: number) {
  if (score >= 7) return "#2F6E51";
  if (score >= 4) return "#C89B3C";
  return "#A63D40";
}

// useSearchParams() requires a Suspense boundary in the App Router, or the
// build either errors or de-opts the whole route to client-side rendering.
export default function CodingRoundPage() {
  return (
    <Suspense
      fallback={
        <main className="min-h-screen bg-background flex items-center justify-center">
          <p className="text-muted-foreground">Preparing your coding round...</p>
        </main>
      }
    >
      <CodingRound />
    </Suspense>
  );
}

function CodingRound() {
  const params = useParams();
  const interviewId = params.id as string;

  const searchParams = useSearchParams();
  // Threaded from the Q&A summary page so this candidate's coding submission
  // can be linked back to their specific Q&A session (see score-interview route).
  const sessionId = searchParams.get("session");

  const [stage, setStage] = useState<Stage>("loading");
  const [question, setQuestion] = useState<CodingQuestion | null>(null);
  const [language, setLanguage] = useState<Language>("javascript");
  const [code, setCode] = useState("");
  const [loadError, setLoadError] = useState("");

  const [running, setRunning] = useState(false);
  const [runError, setRunError] = useState("");
  const [testResults, setTestResults] = useState<TestResult[] | null>(null);
  const [testsPassed, setTestsPassed] = useState(0);
  const [testsTotal, setTestsTotal] = useState(0);

  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const [score, setScore] = useState<number | null>(null);
  const [feedback, setFeedback] = useState("");
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    async function loadQuestion() {
      try {
        const res = await fetch(`/api/coding-question/${interviewId}`);
        const data = await res.json();

        if (!res.ok) {
          setLoadError(data.error || "Failed to load coding round.");
          setStage("notfound");
          return;
        }

        setQuestion(data.codingQuestion);
        setCode(data.codingQuestion.starter_code?.javascript || "");
        setStage("ready");
      } catch (err) {
        setLoadError("Failed to reach the server.");
        setStage("notfound");
      }
    }

    if (interviewId) {
      loadQuestion();
    }
  }, [interviewId]);

  function handleLanguageChange(newLanguage: Language) {
    setLanguage(newLanguage);
    if (question?.starter_code?.[newLanguage] !== undefined) {
      setCode(question.starter_code[newLanguage]);
    }
    setTestResults(null);
    setRunError("");
  }

  async function runCode() {
    if (!question) return;
    setRunning(true);
    setRunError("");
    setTestResults(null);

    try {
      const res = await fetch("/api/run-code", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          language,
          code,
          testCases: question.test_cases,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setRunError(data.error || "Something went wrong running your code.");
        return;
      }

      setTestResults(data.results);
      setTestsPassed(data.testsPassed);
      setTestsTotal(data.testsTotal);
    } catch (err) {
      setRunError("Failed to reach the code execution service.");
    } finally {
      setRunning(false);
    }
  }

  async function submitSolution() {
    if (!question) return;
    setSubmitting(true);
    setSubmitError("");

    try {
      let results = testResults;
      let passed = testsPassed;
      let total = testsTotal;

      if (!results) {
        const runRes = await fetch("/api/run-code", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            language,
            code,
            testCases: question.test_cases,
          }),
        });
        const runData = await runRes.json();

        if (!runRes.ok) {
          setSubmitError(runData.error || "Something went wrong running your code.");
          setSubmitting(false);
          return;
        }

        results = runData.results;
        passed = runData.testsPassed;
        total = runData.testsTotal;
        setTestResults(results);
        setTestsPassed(passed);
        setTestsTotal(total);
      }

      const res = await fetch("/api/score-coding", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          interviewId,
          sessionId,
          codingQuestionId: question.id,
          language,
          code,
          problemPrompt: question.prompt,
          testResults: results,
          testsPassed: passed,
          testsTotal: total,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setSubmitError(data.error || "Something went wrong scoring your submission.");
        return;
      }

      setScore(data.score);
      setFeedback(data.feedback);
      setStage("done");
    } catch (err) {
      setSubmitError("Failed to reach the server.");
    } finally {
      setSubmitting(false);
    }
  }

  async function copySummary() {
    const pct = testsTotal > 0 ? Math.round((testsPassed / testsTotal) * 100) : 0;
    const summary = `AI Interview Practice Booth — Coding Round Result
Score: ${score ?? "—"}/10
Language: ${LANGUAGE_LABELS[language]}
Test cases: ${testsPassed}/${testsTotal} passed (${pct}%)

Feedback:
${feedback}`;

    try {
      await navigator.clipboard.writeText(summary);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      // Clipboard API unavailable — fail silently, button just won't confirm
    }
  }

  if (stage === "loading") {
    return (
      <main className="min-h-screen bg-background flex items-center justify-center">
        <p className="text-muted-foreground">Preparing your coding round...</p>
      </main>
    );
  }

  if (stage === "notfound") {
    return (
      <main className="min-h-screen bg-background flex items-center justify-center px-4">
        <Card className="max-w-md w-full">
          <CardContent className="py-10 text-center space-y-2">
            <p className="text-lg font-heading font-semibold text-foreground">
              Coding round unavailable
            </p>
            <p className="text-muted-foreground text-sm">{loadError}</p>
          </CardContent>
        </Card>
      </main>
    );
  }

  if (stage === "done") {
    const pct = testsTotal > 0 ? Math.round((testsPassed / testsTotal) * 100) : 0;

    return (
      <main className="min-h-screen bg-background px-4 py-12">
        <div className="mx-auto max-w-3xl space-y-8">
          <div className="text-center space-y-2">
            <p className="label-mono">Coding round complete</p>
            <h1 className="text-3xl">Here&apos;s your feedback</h1>
          </div>

          <Card className="relative overflow-hidden">
            <CardHeader>
              <CardTitle>Submission Score</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-muted-foreground">{feedback}</p>

              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="secondary" className="font-mono">
                  {testsPassed} / {testsTotal} test cases passed
                </Badge>
                <Badge variant="secondary" className="font-mono">
                  {LANGUAGE_LABELS[language]}
                </Badge>
              </div>

              {/* Slim test pass-rate bar */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="label-mono">Test pass rate</span>
                  <span
                    className={`label-mono font-medium ${
                      pct >= 70 ? "text-verified" : pct >= 40 ? "text-seal" : "text-destructive"
                    }`}
                  >
                    {pct}%
                  </span>
                </div>
                <div className="w-full h-2 rounded-full bg-muted overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all"
                    style={{
                      width: `${pct}%`,
                      backgroundColor:
                        pct >= 70 ? "#2F6E51" : pct >= 40 ? "#C89B3C" : "#A63D40",
                    }}
                  />
                </div>
              </div>
            </CardContent>

            {score !== null && (
              <div
                className="w-20 h-20 absolute top-4 right-4 flex items-center justify-center"
                style={{
                  background: scoreColor(score),
                  borderRadius: "42% 58% 63% 37% / 41% 44% 56% 59%",
                  transform: "rotate(-8deg)",
                }}
              >
                <span
                  className="font-mono text-sm font-medium text-center leading-tight text-background"
                  style={{ transform: "rotate(8deg)" }}
                >
                  {score}
                  <br />
                  <span className="text-[9px]">/10</span>
                </span>
              </div>
            )}
          </Card>

          {testResults && (
            <Card>
              <CardHeader>
                <CardTitle>Test Case Results</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {testResults.map((r, i) => (
                  <div
                    key={i}
                    className="border-b border-border pb-4 last:border-none last:pb-0 space-y-1"
                  >
                    <div className="flex items-center justify-between">
                      <p className="font-medium text-foreground">Test {i + 1}</p>
                      <span
                        className={`label-mono ${
                          r.passed ? "text-verified" : "text-destructive"
                        }`}
                      >
                        {r.passed ? "Passed" : "Failed"}
                      </span>
                    </div>
                    {!r.passed && (
                      <div className="text-sm space-y-1">
                        <p className="text-muted-foreground">
                          Input: <span className="font-mono">{r.input}</span>
                        </p>
                        <p className="text-muted-foreground">
                          Expected:{" "}
                          <span className="font-mono">{r.expectedOutput}</span>
                        </p>
                        <p className="text-muted-foreground">
                          Got:{" "}
                          <span className="font-mono">
                            {r.actualOutput || r.stderr}
                          </span>
                        </p>
                      </div>
                    )}
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          {/* Navigation + actions */}
          <Card>
            <CardContent className="py-6 space-y-3">
              <div className="flex flex-col sm:flex-row gap-3">
                <Button asChild variant="outline" className="flex-1">
                  <a href="/">← Back to Home</a>
                </Button>
                <Button asChild className="flex-1">
                  <a href="/practice">Practice Again</a>
                </Button>
                <Button
                  onClick={copySummary}
                  variant="outline"
                  className="flex-1"
                  type="button"
                >
                  {copied ? "Copied ✓" : "Copy Summary"}
                </Button>
              </div>

              {sessionId ? (
                <Button asChild variant="outline" className="w-full">
                  <a href={`/api/session-report/${sessionId}`} download>
                    ⬇ Download PDF Report
                  </a>
                </Button>
              ) : (
                <p className="label-mono text-center">
                  PDF report unavailable — no session was linked for this run.
                </p>
              )}

              <div className="text-center">
                <a
                  href="/candidate/dashboard"
                  className="label-mono text-muted-foreground hover:text-foreground transition-colors"
                >
                  Track your progress →
                </a>
              </div>
            </CardContent>
          </Card>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-background px-4 py-12">
      <div className="mx-auto max-w-4xl space-y-6">
        <div className="text-center space-y-1">
          <p className="label-mono">Practical round</p>
          <h1 className="text-2xl">Coding Round</h1>
          <p className="text-muted-foreground text-sm">
            Solve the problem below, run it against the sample tests, then submit
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>{question?.title}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-foreground whitespace-pre-wrap">{question?.prompt}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0">
            <CardTitle>Your Solution</CardTitle>
            <select
              value={language}
              onChange={(e) => handleLanguageChange(e.target.value as Language)}
              className="rounded-md border border-border bg-background px-3 py-1.5 text-sm text-foreground font-mono"
            >
              {Object.entries(LANGUAGE_LABELS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </CardHeader>
          <CardContent className="space-y-4">
            <textarea
              value={code}
              onChange={(e) => setCode(e.target.value)}
              spellCheck={false}
              rows={16}
              className="w-full rounded-md border border-border bg-foreground text-background font-mono text-sm p-4 leading-relaxed"
            />

            <div className="flex gap-3">
              <Button onClick={runCode} disabled={running} variant="outline" className="flex-1">
                {running ? "Running..." : "Run Code"}
              </Button>
              <Button onClick={submitSolution} disabled={submitting} className="flex-1">
                {submitting ? "Submitting..." : "Submit Solution"}
              </Button>
            </div>

            {runError && <p className="text-sm text-destructive">{runError}</p>}
            {submitError && <p className="text-sm text-destructive">{submitError}</p>}
          </CardContent>
        </Card>

        {testResults && (
          <Card>
            <CardHeader>
              <CardTitle>
                Test Results: {testsPassed} / {testsTotal} passed
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {testResults.map((r, i) => (
                <div
                  key={i}
                  className="border-b border-border pb-4 last:border-none last:pb-0 space-y-1"
                >
                  <div className="flex items-center justify-between">
                    <p className="font-medium text-foreground">Test {i + 1}</p>
                    <span
                      className={`label-mono ${
                        r.passed ? "text-verified" : "text-destructive"
                      }`}
                    >
                      {r.passed ? "Passed" : "Failed"}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground font-mono">
                    Input: {r.input || "(none)"}
                  </p>
                  {!r.passed && (
                    <>
                      <p className="text-xs text-muted-foreground font-mono">
                        Expected: {r.expectedOutput}
                      </p>
                      <p className="text-xs text-muted-foreground font-mono">
                        Got: {r.actualOutput || r.stderr || "(no output)"}
                      </p>
                    </>
                  )}
                </div>
              ))}
            </CardContent>
          </Card>
        )}
      </div>
    </main>
  );
}
