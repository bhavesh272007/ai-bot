// TARGET PATH: app/sample-coding/page.tsx
//
// A public, no-signup walkthrough of the coding round.
//
// The layout deliberately mirrors the classic (non-meeting) coding round in
// app/interview/[id]/coding/page.tsx — same cards, same language select, same
// editor, same score blob — because the point of the page is to show what the
// real thing looks like. Anything that looked nicer here than in the real round
// would be a lie.
//
// What's different: three fixed problems instead of one generated from a job
// description, a button that fills in a working solution, a tips panel, and
// nothing at all is written to the database.
"use client";

import { useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  SAMPLE_PROBLEMS,
  CODING_ROUND_TIPS,
  type SampleLanguage,
  type SampleProblem,
} from "@/lib/sample-coding";

interface TestResult {
  input: string;
  expectedOutput: string;
  actualOutput: string;
  stderr: string;
  passed: boolean;
}

const LANGUAGE_LABELS: Record<SampleLanguage, string> = {
  javascript: "JavaScript",
  python: "Python",
  java: "Java",
  cpp: "C++",
};

// Same thresholds as the real round, so a colour means the same thing on both.
function scoreColor(score: number) {
  if (score >= 7) return "#2F6E51";
  if (score >= 4) return "#C89B3C";
  return "#A63D40";
}

export default function SampleCodingPage() {
  const [problem, setProblem] = useState<SampleProblem>(SAMPLE_PROBLEMS[0]);
  const [language, setLanguage] = useState<SampleLanguage>("javascript");
  const [code, setCode] = useState(SAMPLE_PROBLEMS[0].starterCode.javascript);

  const [testResults, setTestResults] = useState<TestResult[] | null>(null);
  const [testsPassed, setTestsPassed] = useState(0);
  const [testsTotal, setTestsTotal] = useState(0);

  const [score, setScore] = useState<number | null>(null);
  const [feedback, setFeedback] = useState("");

  const [running, setRunning] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [runError, setRunError] = useState("");
  const [submitError, setSubmitError] = useState("");

  // Any change of problem or language invalidates every result on screen —
  // leaving a stale "3/3 passed" next to freshly swapped code would be worse
  // than showing nothing.
  function clearResults() {
    setTestResults(null);
    setTestsPassed(0);
    setTestsTotal(0);
    setScore(null);
    setFeedback("");
    setRunError("");
    setSubmitError("");
  }

  function handleProblemChange(next: SampleProblem) {
    if (next.id === problem.id) return;
    setProblem(next);
    setCode(next.starterCode[language]);
    clearResults();
  }

  function handleLanguageChange(next: SampleLanguage) {
    setLanguage(next);
    setCode(problem.starterCode[next]);
    clearResults();
  }

  function loadSolution() {
    setCode(problem.solutionCode[language]);
    clearResults();
  }

  function resetCode() {
    setCode(problem.starterCode[language]);
    clearResults();
  }

  async function runCode() {
    setRunning(true);
    setRunError("");
    setTestResults(null);
    setScore(null);
    setFeedback("");

    try {
      const res = await fetch("/api/run-code", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          language,
          code,
          testCases: problem.testCases,
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
    } catch {
      setRunError("Failed to reach the code execution service.");
    } finally {
      setRunning(false);
    }
  }

  async function submitSolution() {
    setSubmitting(true);
    setSubmitError("");

    try {
      // Same two-step as the real round: the AI is only ever shown test results
      // that actually ran, so it can't be asked to grade correctness blind.
      let results = testResults;
      let passed = testsPassed;
      let total = testsTotal;

      if (!results) {
        const runRes = await fetch("/api/run-code", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ language, code, testCases: problem.testCases }),
        });
        const runData = await runRes.json();

        if (!runRes.ok) {
          setSubmitError(runData.error || "Something went wrong running your code.");
          return;
        }

        results = runData.results;
        passed = runData.testsPassed;
        total = runData.testsTotal;
        setTestResults(results);
        setTestsPassed(passed);
        setTestsTotal(total);
      }

      const res = await fetch("/api/sample-coding-feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          problemId: problem.id,
          language,
          code,
          testResults: results,
          testsPassed: passed,
          testsTotal: total,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setSubmitError(data.error || "Something went wrong reviewing your code.");
        return;
      }

      setScore(data.score);
      setFeedback(data.feedback);
    } catch {
      setSubmitError("Failed to reach the review service.");
    } finally {
      setSubmitting(false);
    }
  }

  const pct = testsTotal > 0 ? Math.round((testsPassed / testsTotal) * 100) : 0;

  return (
    <main className="min-h-screen bg-background px-4 py-12">
      <div className="mx-auto max-w-4xl space-y-6">
        <div className="text-center space-y-1">
          <p className="label-mono">Practice mode</p>
          <h1 className="text-2xl">Sample Coding Round</h1>
          <p className="text-muted-foreground text-sm">
            This is the exact interface you get in a real interview. Nothing here is
            timed, scored against you, or saved.
          </p>
        </div>

        {/* Problem picker — the real round gives you one problem generated from
            the job description; here you can switch freely. */}
        <div className="flex flex-wrap items-center justify-center gap-2">
          {SAMPLE_PROBLEMS.map((p) => {
            const active = p.id === problem.id;
            return (
              <button
                key={p.id}
                type="button"
                onClick={() => handleProblemChange(p)}
                aria-pressed={active}
                className={`rounded-full border px-4 py-1.5 text-sm transition-colors ${
                  active
                    ? "border-foreground bg-foreground text-background"
                    : "border-border text-muted-foreground hover:text-foreground hover:border-foreground"
                }`}
              >
                {p.title}
              </button>
            );
          })}
        </div>

        <Card>
          <CardHeader className="flex flex-row items-start justify-between space-y-0 gap-4">
            <CardTitle>{problem.title}</CardTitle>
            <div className="flex shrink-0 gap-2">
              <Badge variant="secondary" className="font-mono">
                {problem.difficulty}
              </Badge>
              <Badge variant="secondary" className="font-mono">
                {problem.topic}
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-foreground whitespace-pre-wrap">{problem.prompt}</p>

            <div className="space-y-2 border-t border-border pt-4">
              <p className="label-mono">
                Test cases your code runs against ({problem.testCases.length})
              </p>
              {problem.testCases.map((tc, i) => (
                <div
                  key={i}
                  className="text-xs font-mono text-muted-foreground flex flex-wrap gap-x-4"
                >
                  <span>stdin: {tc.input.replace(/\n/g, " ⏎ ")}</span>
                  <span>stdout: {tc.expectedOutput}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0">
            <CardTitle>Your Solution</CardTitle>
            <select
              value={language}
              onChange={(e) => handleLanguageChange(e.target.value as SampleLanguage)}
              aria-label="Language"
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
              aria-label="Code editor"
              className="w-full rounded-md border border-border bg-foreground text-background font-mono text-sm p-4 leading-relaxed"
            />

            <div className="flex gap-3">
              <Button onClick={runCode} disabled={running} variant="outline" className="flex-1">
                {running ? "Running..." : "Run Code"}
              </Button>
              <Button onClick={submitSolution} disabled={submitting} className="flex-1">
                {submitting ? "Reviewing..." : "Submit for Feedback"}
              </Button>
            </div>

            {/* Not present in the real round — here so someone who only wants to
                see what a passing run and real AI feedback look like can get
                there without solving anything first. */}
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
              <button
                type="button"
                onClick={loadSolution}
                className="label-mono text-muted-foreground hover:text-foreground transition-colors"
              >
                Load a working solution
              </button>
              <button
                type="button"
                onClick={resetCode}
                className="label-mono text-muted-foreground hover:text-foreground transition-colors"
              >
                Reset to starter code
              </button>
              <p className="label-mono text-muted-foreground">
                (the real round has neither — you start from the boilerplate)
              </p>
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

        {score !== null && (
          <Card className="relative overflow-hidden">
            <CardHeader>
              <CardTitle>AI Feedback</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 pr-24">
              <p className="text-foreground">{feedback}</p>

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

              <p className="label-mono text-muted-foreground">
                Scored the same way as a real round — 60% test results, 40% code
                quality and efficiency. Not saved anywhere.
              </p>
            </CardContent>

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
          </Card>
        )}

        <Card>
          <CardHeader>
            <CardTitle>How to handle this round</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {CODING_ROUND_TIPS.map((tip) => (
              <div
                key={tip.title}
                className="border-b border-border pb-4 last:border-none last:pb-0 space-y-1"
              >
                <p className="font-medium text-foreground">{tip.title}</p>
                <p className="text-sm text-muted-foreground">{tip.body}</p>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>What changes in a real round</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li>
                The problem is generated from the job description you're interviewing
                against, so it matches the role's level and stack.
              </li>
              <li>
                It comes after a spoken question round, and the interviewer talks you
                through it — in meeting mode your mic stays on, and how you explain
                your thinking becomes part of the written feedback.
              </li>
              <li>
                Your score is saved to your progress history, and you can download a
                PDF report of the whole interview.
              </li>
              <li>You get one problem and no working solution to fall back on.</li>
            </ul>

            <div className="flex flex-col sm:flex-row gap-3 pt-2">
              <Button asChild variant="outline" className="flex-1">
                <Link href="/">← Back to Home</Link>
              </Button>
              <Button asChild className="flex-1">
                <Link href="/practice">Start a Real Practice Interview</Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
