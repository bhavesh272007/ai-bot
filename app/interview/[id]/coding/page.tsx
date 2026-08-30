// TARGET PATH: app/interview/[id]/coding/page.tsx
"use client";

import { useState, useEffect, useRef, Suspense } from "react";
import { useParams, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { MeetingModeCoding } from "@/components/interview/meeting-mode-coding";
import { MeetingCallEnded } from "@/components/interview/meeting-call-ended";
import { useTextToSpeech } from "@/lib/voice/useTextToSpeech";
import { useAudioLevel } from "@/lib/voice/useAudioLevel";
import { useNetworkInfo } from "@/lib/voice/useNetworkInfo";
import { useVoiceCapture } from "@/lib/voice/useVoiceCapture";
import {
  clearMeetingSession,
  formatElapsed,
  loadMeetingSession,
  useElapsedSeconds,
  type MeetingSessionState,
} from "@/lib/meeting-session";
import { toDisplayScore } from "@/lib/scoring";
import type { SessionDetail } from "@/components/dashboard/charts";

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

// "callended" is meeting-mode only — the hang-up beat between submitting and
// seeing the combined report. Classic mode still goes straight to "done".
type Stage = "loading" | "ready" | "notfound" | "callended" | "done";
type Language = "javascript" | "python" | "java" | "cpp";

const LANGUAGE_LABELS: Record<Language, string> = {
  javascript: "JavaScript",
  python: "Python",
  java: "Java",
  cpp: "C++",
};

const LANGUAGE_OPTIONS = Object.entries(LANGUAGE_LABELS).map(([value, label]) => ({
  value,
  label,
}));

// Cosmetic editor tab label on the shared screen — nothing reads these.
const LANGUAGE_EXTENSIONS: Record<Language, string> = {
  javascript: "js",
  python: "py",
  java: "java",
  cpp: "cpp",
};

// What the interviewer says during the coding round. Scripted, not generated:
// these are conversational beats, so an AI call would add cost and latency
// without adding anything the candidate needs. The problem text itself stays
// on screen and is never read aloud — it's a shared screen, and hearing an
// input format spoken is worse than useless.
const CODING_LINES = {
  intro: (title: string) =>
    `Alright, let's move on to some code. I've shared a problem on my screen — ${title}. Take a moment to read it, and talk me through your approach as you go.`,
  allPassed: "Nice, everything passes. Anything you'd change about the complexity?",
  someFailed:
    "Looks like a couple of cases are failing — walk me through what you expect to happen there.",
  closing: "Thanks for your time — that's everything from my side.",
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
  // The explicit "this is still the same meeting" signal. On its own it isn't
  // enough — the call's details live in sessionStorage, and without them we'd
  // be rendering a half-configured call, so both have to be present.
  const wantsMeeting = searchParams.get("meeting") === "1";

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

  // ---------- Meeting mode ----------
  // Read in an effect rather than a lazy useState initializer: sessionStorage
  // doesn't exist during SSR, so deciding the layout from it during the first
  // render would be a hydration mismatch.
  const [meeting, setMeeting] = useState<MeetingSessionState | null>(null);
  const meetingMode = meeting !== null;

  const [voiceEnabled, setVoiceEnabled] = useState(true);
  const [micAutoOn, setMicAutoOn] = useState(true);
  // The candidate's narration for the whole round, appended to continuously —
  // never cleared between runs, since it's one train of thought.
  const [thinkAloud, setThinkAloud] = useState("");
  // The line the interviewer is on, plus how much of it has been spoken.
  const [spokenLine, setSpokenLine] = useState("");
  const [wordsSpoken, setWordsSpoken] = useState(0);
  const [speakTick, setSpeakTick] = useState(0);
  const introSpokenRef = useRef(false);

  const [combined, setCombined] = useState<SessionDetail | null>(null);
  const [combinedError, setCombinedError] = useState("");

  const tts = useTextToSpeech();
  const audioLevel = useAudioLevel();
  const networkInfo = useNetworkInfo();

  // One clock across both rounds — the Q&A page stored when the call began, so
  // this picks up counting instead of restarting at 0:00. Frozen once the call
  // ends: at that point it's a duration, not a clock.
  const elapsedSeconds = useElapsedSeconds(meeting?.startedAt ?? null, stage === "ready");

  const voice = useVoiceCapture({
    getBaseText: () => thinkAloud,
    setText: setThinkAloud,
    autoListen: meetingMode && stage === "ready" && micAutoOn,
    autoListenBlocked: tts.isSpeaking,
    // Long silences are normal while someone is reading and typing, so the
    // Q&A round's tight cap would kill the mic partway through. The hook also
    // refreshes this budget on any real speech.
    maxAutoRestarts: 240,
    // No native recognition means every "listen" is a Whisper upload, so
    // narration becomes press-to-record instead of staying live (see
    // toggleMicAuto). Leaving auto-listen on there would upload silence.
    autoListenNativeOnly: true,
  });
  // Browsers without native SpeechRecognition narrate by explicit recording.
  const pushToTalk = !voice.micSupported;

  useEffect(() => {
    if (!wantsMeeting) return;
    const loaded = loadMeetingSession(interviewId);
    if (!loaded) return;
    setMeeting(loaded);
    setVoiceEnabled(loaded.voiceEnabled);
    setMicAutoOn(loaded.micAutoOn);
  }, [wantsMeeting, interviewId]);

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

  // Speaks one scripted line and drives its caption. When the interviewer is
  // muted the caption is revealed in full immediately — in this round the
  // caption is the only record of what was said, so leaving it empty would
  // silently drop the line.
  function speakLine(text: string) {
    setSpokenLine(text);
    const canSpeak = voiceEnabled && tts.isSupported;
    setWordsSpoken(canSpeak ? 0 : text.split(" ").length);
    if (!canSpeak) return;

    tts.speak(text, {
      rate: 1,
      voiceName: meeting?.voiceName || undefined,
      onBoundary: () => {
        setSpeakTick((t) => t + 1);
        setWordsSpoken((w) => w + 1);
      },
    });
  }

  // Caption fallback: onBoundary is best-effort — some browser voices never
  // fire word-boundary events at all, which would freeze the caption at zero.
  // This advances it at a fixed pace purely off tts.isSpeaking, and is
  // harmless when boundary events do fire since the caption is clamped to the
  // line's word count. Same mechanic as the Q&A round.
  useEffect(() => {
    if (!tts.isSpeaking) return;
    const WORDS_PER_SECOND = 2.3;
    const id = setInterval(() => setWordsSpoken((w) => w + 1), 1000 / WORDS_PER_SECOND);
    return () => clearInterval(id);
  }, [tts.isSpeaking]);

  // The interviewer introduces the problem once it's on screen.
  useEffect(() => {
    if (!meetingMode || stage !== "ready" || !question || introSpokenRef.current) return;
    introSpokenRef.current = true;
    speakLine(CODING_LINES.intro(question.title));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [meetingMode, stage, question]);

  // Sign-off on the hang-up screen.
  useEffect(() => {
    if (stage !== "callended") return;
    speakLine(CODING_LINES.closing);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stage]);

  // Fetch the combined report while the interviewer is still signing off, so
  // "View your report" doesn't land on a spinner.
  useEffect(() => {
    if (stage !== "callended" || !sessionId) return;
    let cancelled = false;

    (async () => {
      try {
        const res = await fetch(`/api/session-detail/${sessionId}`);
        const json = await res.json();
        if (cancelled) return;
        if (!res.ok) {
          setCombinedError(json.error || "Couldn't load your full report.");
          return;
        }
        setCombined(json);
      } catch {
        if (!cancelled) setCombinedError("Couldn't reach the server for your full report.");
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [stage, sessionId]);

  // Mirror the Q&A round: the avatar's mouth reacts to real mic amplitude
  // while the candidate is narrating.
  useEffect(() => {
    if (voice.isListening) {
      audioLevel.start().catch(() => {
        // Best-effort — the avatar just keeps a resting mouth. Narration
        // capture itself is unaffected.
      });
    } else {
      audioLevel.stop();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [voice.isListening]);

  useEffect(() => {
    return () => {
      tts.cancel();
      audioLevel.stop();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function toggleVoiceEnabled() {
    if (voiceEnabled) tts.cancel();
    setVoiceEnabled((v) => !v);
  }

  function toggleMicAuto() {
    if (pushToTalk) {
      if (!voice.isListening) tts.cancel();
      voice.toggle();
      return;
    }
    setMicAutoOn((prev) => {
      const next = !prev;
      if (!next && voice.isListening) voice.stop();
      return next;
    });
  }

  function replayLine() {
    if (!spokenLine) return;
    speakLine(spokenLine);
  }

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
    // Whatever happened before, the candidate is clearly still here — give the
    // mic keeper a fresh budget.
    voice.resetAutoRestarts();

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

      if (meetingMode) {
        speakLine(
          data.testsTotal > 0 && data.testsPassed === data.testsTotal
            ? CODING_LINES.allPassed
            : CODING_LINES.someFailed
        );
      }
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
    voice.resetAutoRestarts();
    // Nothing said after "submit" is part of the solution — close the mic
    // rather than leaving it live on the way out of the call.
    if (voice.isListening) voice.stop();

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
          // Meeting mode only — colours the written feedback with a note on
          // how the candidate communicated. Never moves the score.
          thinkAloud: meetingMode ? thinkAloud.trim() || null : null,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setSubmitError(data.error || "Something went wrong scoring your submission.");
        return;
      }

      setScore(data.score);
      setFeedback(data.feedback);
      setStage(meetingMode ? "callended" : "done");
    } catch (err) {
      setSubmitError("Failed to reach the server.");
    } finally {
      setSubmitting(false);
    }
  }

  // The call is over by the time the report is up, so the meeting state has
  // served its purpose — drop it rather than leaving it to be picked up by a
  // later navigation in the same tab.
  function showReport() {
    tts.cancel();
    clearMeetingSession(interviewId);
    setStage("done");
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
    // Stay dark when we're mid-call, so the round change doesn't strobe white.
    if (wantsMeeting) {
      return (
        <main className="min-h-screen bg-black text-white flex items-center justify-center">
          <p className="text-sm text-neutral-500">Sharing the problem…</p>
        </main>
      );
    }
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

  // ---------- CALL ENDED (meeting mode only) ----------
  // The hang-up beat: the interviewer signs off while the combined report
  // loads in the background, and the candidate clicks through when ready.
  if (stage === "callended") {
    return (
      <MeetingCallEnded
        elapsedLabel={formatElapsed(elapsedSeconds)}
        roleLabel={meeting?.roleLabel || "Interviewer"}
        lineText={spokenLine}
        revealedWordCount={wordsSpoken}
        avatarState={tts.isSpeaking ? "speaking" : "idle"}
        speakTick={speakTick}
        // Nothing left to wait for once the fetch has landed — or if there was
        // never a session to fetch, or the fetch already failed. In those last
        // two cases the report still opens, just coding-only.
        reportReady={combined !== null || !sessionId || combinedError !== ""}
        onViewReport={showReport}
      />
    );
  }

  if (stage === "done") {
    const pct = testsTotal > 0 ? Math.round((testsPassed / testsTotal) * 100) : 0;
    // Meeting mode never showed a mid-flow score, so this one report has to
    // cover the whole call. Everything below the combined block is exactly what
    // classic mode has always rendered.
    const showCombined = meetingMode && combined !== null;

    return (
      <main className="min-h-screen bg-background px-4 py-12">
        <div className="mx-auto max-w-3xl space-y-8">
          <div className="text-center space-y-2">
            <p className="label-mono">
              {showCombined ? "Interview complete" : "Coding round complete"}
            </p>
            <h1 className="text-3xl">
              {showCombined ? "Here’s your full report" : "Here’s your feedback"}
            </h1>
          </div>

          {meetingMode && combined && (
            <>
              <Card className="relative overflow-hidden">
                <CardHeader>
                  <CardTitle>Overall Performance</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {combined.overallFeedback && (
                    <p className="text-muted-foreground">{combined.overallFeedback}</p>
                  )}

                  {combined.subjects.length > 0 && (
                    <div className="space-y-3">
                      <p className="label-mono">By subject</p>
                      {combined.subjects.map((s) => {
                        const subjectPct = toDisplayScore(s.average);
                        return (
                          <div key={s.subject} className="space-y-1.5">
                            <div className="flex items-center justify-between">
                              <span className="text-sm text-foreground">
                                {s.subject}
                                <span className="text-muted-foreground">
                                  {" "}
                                  · {s.count} {s.count === 1 ? "question" : "questions"}
                                </span>
                              </span>
                              <span className="label-mono font-medium">{subjectPct}%</span>
                            </div>
                            <div className="w-full h-2 rounded-full bg-muted overflow-hidden">
                              <div
                                className="h-full rounded-full transition-all"
                                style={{
                                  width: `${subjectPct}%`,
                                  backgroundColor: scoreColor(s.average),
                                }}
                              />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </CardContent>

                {combined.overallScore !== null && (
                  <div
                    className="w-20 h-20 absolute top-4 right-4 flex items-center justify-center"
                    style={{
                      background: scoreColor(combined.overallScore),
                      borderRadius: "58% 42% 37% 63% / 44% 41% 59% 56%",
                      transform: "rotate(6deg)",
                    }}
                  >
                    <span
                      className="font-mono text-sm font-medium text-center leading-tight text-background"
                      style={{ transform: "rotate(-6deg)" }}
                    >
                      {toDisplayScore(combined.overallScore)}
                      <br />
                      <span className="text-[9px]">/100</span>
                    </span>
                  </div>
                )}
              </Card>

              {(combined.strengths.length > 0 || combined.improvements.length > 0) && (
                <div className="grid gap-6 sm:grid-cols-2">
                  {combined.strengths.length > 0 && (
                    <Card>
                      <CardHeader>
                        <CardTitle>What went well</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <ul className="space-y-2">
                          {combined.strengths.map((s, i) => (
                            <li key={i} className="text-sm text-muted-foreground">
                              <span className="text-verified">+</span> {s}
                            </li>
                          ))}
                        </ul>
                      </CardContent>
                    </Card>
                  )}

                  {combined.improvements.length > 0 && (
                    <Card>
                      <CardHeader>
                        <CardTitle>What to work on</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <ul className="space-y-2">
                          {combined.improvements.map((s, i) => (
                            <li key={i} className="text-sm text-muted-foreground">
                              <span className="text-seal">→</span> {s}
                            </li>
                          ))}
                        </ul>
                      </CardContent>
                    </Card>
                  )}
                </div>
              )}
            </>
          )}

          {/* Meeting mode with nothing to combine: the coding result below is
              still complete, so say what's missing rather than hiding it. */}
          {meetingMode && !combined && (
            <p className="label-mono text-center">
              {combinedError ||
                "Your discussion-round feedback couldn’t be loaded — the coding result below is unaffected."}
            </p>
          )}

          <Card className="relative overflow-hidden">
            <CardHeader>
              <CardTitle>{showCombined ? "Coding Round" : "Submission Score"}</CardTitle>
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

  // ---------- READY, IN THE CALL (meeting mode only) ----------
  // Same round, same data, same handlers as the light page below — the problem
  // and editor just become the interviewer's shared screen.
  if (meetingMode && question) {
    return (
      <MeetingModeCoding
        elapsedLabel={formatElapsed(elapsedSeconds)}
        networkInfo={networkInfo}
        roleLabel={meeting?.roleLabel || "Interviewer"}
        title={question.title}
        prompt={question.prompt}
        testCases={question.test_cases || []}
        fileName={`solution.${LANGUAGE_EXTENSIONS[language]}`}
        language={language}
        languageOptions={LANGUAGE_OPTIONS}
        onLanguageChange={(value) => handleLanguageChange(value as Language)}
        code={code}
        onCodeChange={setCode}
        testResults={testResults}
        testsPassed={testsPassed}
        testsTotal={testsTotal}
        runError={runError}
        submitError={submitError}
        running={running}
        submitting={submitting}
        onRun={runCode}
        onSubmit={submitSolution}
        lineText={spokenLine}
        revealedWordCount={wordsSpoken}
        avatarState={tts.isSpeaking ? "speaking" : voice.isListening ? "listening" : "idle"}
        speakTick={speakTick}
        micLevel={audioLevel.level}
        voiceEnabled={voiceEnabled}
        onToggleVoice={toggleVoiceEnabled}
        onReplay={replayLine}
        cameraEnabled={meeting?.cameraEnabled ?? false}
        thinkAloud={thinkAloud}
        voiceInputSupported={voice.voiceInputSupported}
        micAutoOn={micAutoOn}
        onToggleMicAuto={toggleMicAuto}
        isListening={voice.isListening}
        usingFallback={voice.usingFallback}
        transcribing={voice.transcribing}
        pushToTalk={pushToTalk}
      />
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
