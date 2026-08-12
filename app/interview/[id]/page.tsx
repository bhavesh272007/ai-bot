// TARGET PATH: app/interview/[id]/page.tsx
"use client";

import { useState, useEffect, useRef } from "react";
import { useParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Mic, Volume2, VolumeX, RotateCcw, Loader2, AlertCircle } from "lucide-react";
import { ResumeUpload } from "@/components/resume-upload";

interface Question {
  category: string;
  question: string;
}

interface Answer {
  category: string;
  question: string;
  answer: string;
}

interface ScoredAnswer {
  question: string;
  score: number;
  strengths: string;
  improvements: string;
}

interface ScoreResult {
  answers: ScoredAnswer[];
  overall_score: number;
  overall_feedback: string;
  sessionId?: string;
}

type Stage = "loading" | "intro" | "interview" | "summary" | "notfound";

// Minimal shapes for the Web Speech API result event (no official TS types needed)
type SpeechRecognitionResultLike = {
  isFinal: boolean;
  0: { transcript: string };
};
type SpeechRecognitionEventLike = {
  resultIndex: number;
  results: SpeechRecognitionResultLike[] & { length: number };
};

function scoreColor(score: number) {
  if (score >= 7) return "#2F6E51";
  if (score >= 4) return "#C89B3C";
  return "#A63D40";
}

function scoreTextClass(score: number) {
  if (score >= 7) return "text-verified";
  if (score >= 4) return "text-seal";
  return "text-destructive";
}

export default function CandidateInterview() {
  const params = useParams();
  const interviewId = params.id as string;

  const [stage, setStage] = useState<Stage>("loading");
  const [questions, setQuestions] = useState<Question[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [currentAnswer, setCurrentAnswer] = useState("");
  const [answers, setAnswers] = useState<Answer[]>([]);

  const [scoring, setScoring] = useState(false);
  const [scoreResult, setScoreResult] = useState<ScoreResult | null>(null);
  const [scoreError, setScoreError] = useState("");

  // ---------- Self-practice context (no recruiter link) ----------
  const [isPractice, setIsPractice] = useState(false);
  const [targetRole, setTargetRole] = useState("");
  const [targetCompany, setTargetCompany] = useState("");
  const [targetLevel, setTargetLevel] = useState("");

  // ---------- Resume personalization (recruiter-shared interviews only) ----------
  const [resumeText, setResumeText] = useState<string | null>(null);
  const [personalizing, setPersonalizing] = useState(false);
  const [personalizeError, setPersonalizeError] = useState("");

  // ---------- Voice (STT + TTS) state ----------
  const [voiceSupported, setVoiceSupported] = useState(false);
  const [micSupported, setMicSupported] = useState(false);
  const [voiceEnabled, setVoiceEnabled] = useState(true); // auto-read questions aloud
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isListening, setIsListening] = useState(false);

  const recognitionRef = useRef<any>(null);
  const baseAnswerRef = useRef(""); // committed transcript before the current listening session

  // ---------- Dynamic follow-up (Phase 13) state ----------
  const MAX_FOLLOWUPS = 3; // cap total follow-ups per interview (cost + pacing)
  const [activeFollowUp, setActiveFollowUp] = useState<{
    category: string;
    question: string;
  } | null>(null);
  const [followUpCount, setFollowUpCount] = useState(0);
  const [checkingFollowUp, setCheckingFollowUp] = useState(false);

  // The question actually being shown right now — either the next scripted
  // question, or a follow-up probing the answer just given.
  const currentQuestion = activeFollowUp ?? questions[currentIndex];

  // Feature-detect once on mount (must run client-side only)
  useEffect(() => {
    setVoiceSupported(typeof window !== "undefined" && "speechSynthesis" in window);
    const SpeechRecognitionCtor =
      typeof window !== "undefined" &&
      ((window as any).SpeechRecognition || (window as any).webkitSpeechRecognition);
    setMicSupported(!!SpeechRecognitionCtor);
  }, []);

  useEffect(() => {
    async function loadInterview() {
      try {
        const res = await fetch(`/api/interview/${interviewId}`);
        const data = await res.json();

        if (!res.ok) {
          setStage("notfound");
          return;
        }

        setQuestions(data.questions);
        setIsPractice(!!data.isPractice);
        setTargetRole(data.targetRole || "");
        setTargetCompany(data.targetCompany || "");
        setTargetLevel(data.targetLevel || "");
        setStage("intro");
      } catch (err) {
        setStage("notfound");
      }
    }

    if (interviewId) {
      loadInterview();
    }
  }, [interviewId]);

  // Speak the current question aloud whenever it changes (Phase 12: TTS)
  useEffect(() => {
    if (stage !== "interview" || !voiceEnabled || !voiceSupported) return;
    if (!currentQuestion) return;

    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(currentQuestion.question);
    utterance.rate = 1;
    utterance.onstart = () => setIsSpeaking(true);
    utterance.onend = () => setIsSpeaking(false);
    utterance.onerror = () => setIsSpeaking(false);
    window.speechSynthesis.speak(utterance);

    return () => {
      window.speechSynthesis.cancel();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stage, currentIndex, activeFollowUp, voiceEnabled, voiceSupported]);

  // Stop any speech/recognition on unmount
  useEffect(() => {
    return () => {
      if (typeof window !== "undefined") window.speechSynthesis.cancel();
      recognitionRef.current?.stop();
    };
  }, []);

  function replayQuestion() {
    if (!voiceSupported || !currentQuestion) return;
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(currentQuestion.question);
    utterance.onstart = () => setIsSpeaking(true);
    utterance.onend = () => setIsSpeaking(false);
    utterance.onerror = () => setIsSpeaking(false);
    window.speechSynthesis.speak(utterance);
  }

  function toggleVoiceEnabled() {
    if (voiceEnabled) {
      window.speechSynthesis.cancel();
      setIsSpeaking(false);
    }
    setVoiceEnabled((v) => !v);
  }

  // Phase 11: STT — mic button transcribes into the same textarea as typing
  function toggleListening() {
    if (!micSupported) return;

    if (isListening) {
      recognitionRef.current?.stop();
      return;
    }

    // Don't let the AI talk over the student
    window.speechSynthesis.cancel();
    setIsSpeaking(false);

    const SpeechRecognitionCtor =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    const recognition = new SpeechRecognitionCtor();
    recognition.lang = "en-US";
    recognition.continuous = true;
    recognition.interimResults = true;

    // Keep whatever's already typed/transcribed and append to it
    baseAnswerRef.current = currentAnswer ? currentAnswer.trim() + " " : "";

    recognition.onresult = (event: SpeechRecognitionEventLike) => {
      let interim = "";
      let final = "";
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const transcript = event.results[i][0].transcript;
        if (event.results[i].isFinal) {
          final += transcript + " ";
        } else {
          interim += transcript;
        }
      }
      if (final) {
        baseAnswerRef.current = baseAnswerRef.current + final;
      }
      setCurrentAnswer((baseAnswerRef.current + interim).trim());
    };

    recognition.onerror = () => setIsListening(false);
    recognition.onend = () => setIsListening(false);

    recognitionRef.current = recognition;
    recognition.start();
    setIsListening(true);
  }

  function stopVoiceActivity() {
    window.speechSynthesis.cancel();
    setIsSpeaking(false);
    if (isListening) {
      recognitionRef.current?.stop();
    }
  }

  function beginInterview() {
    setAnswers([]);
    setCurrentIndex(0);
    setCurrentAnswer("");
    setActiveFollowUp(null);
    setFollowUpCount(0);
    setStage("interview");
  }

  // Only relevant for recruiter-shared interviews — practice-mode resume
  // upload already happened at generation time on /practice. This rewrites
  // the LOCAL question list only; the interview's stored `questions` rows
  // (the recruiter's template) are never modified, so other candidates on
  // the same link are unaffected.
  async function handleBeginWithPersonalization() {
    if (!resumeText) {
      beginInterview();
      return;
    }

    setPersonalizing(true);
    setPersonalizeError("");

    try {
      const res = await fetch("/api/personalize-questions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ interviewId, resumeText }),
      });
      const data = await res.json();

      if (!res.ok) {
        setPersonalizeError(
          data.error || "Couldn't personalize your questions — starting with the originals instead."
        );
        beginInterview();
        return;
      }

      setQuestions(data.questions);
      beginInterview();
    } catch (err) {
      setPersonalizeError(
        "Couldn't reach the server to personalize your questions — starting with the originals instead."
      );
      beginInterview();
    } finally {
      setPersonalizing(false);
    }
  }

  function advanceToNextMainQuestion(updatedAnswers: Answer[]) {
    if (currentIndex + 1 < questions.length) {
      setCurrentIndex(currentIndex + 1);
    } else {
      setStage("summary");
      scoreInterview(updatedAnswers);
    }
  }

  async function handleNext() {
    stopVoiceActivity();
    if (checkingFollowUp || !currentQuestion) return;

    const wasFollowUp = !!activeFollowUp;
    const updatedAnswers = [
      ...answers,
      {
        category: currentQuestion.category,
        question: currentQuestion.question,
        answer: currentAnswer.trim() || "(no answer given)",
      },
    ];
    setAnswers(updatedAnswers);
    setCurrentAnswer("");

    // Just answered a follow-up — move straight to the next scripted question
    if (wasFollowUp) {
      setActiveFollowUp(null);
      advanceToNextMainQuestion(updatedAnswers);
      return;
    }

    // Just answered a scripted question — see if it's worth probing further
    if (followUpCount < MAX_FOLLOWUPS) {
      setCheckingFollowUp(true);
      try {
        const res = await fetch("/api/generate-followup", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            category: currentQuestion.category,
            question: currentQuestion.question,
            answer: updatedAnswers[updatedAnswers.length - 1].answer,
          }),
        });
        const data = await res.json();
        setCheckingFollowUp(false);

        if (data.followUp) {
          setFollowUpCount((c) => c + 1);
          setActiveFollowUp({
            category: currentQuestion.category,
            question: data.followUp,
          });
          return; // stay on the interview screen showing the follow-up
        }
      } catch (err) {
        setCheckingFollowUp(false);
        // fall through — if the follow-up check fails, just continue the interview
      }
    }

    advanceToNextMainQuestion(updatedAnswers);
  }

  // Skipping deliberately bypasses the follow-up-question check — probing a
  // question the candidate explicitly chose not to answer doesn't make sense.
  // The skip is still recorded as an answer (not silently dropped) so it
  // shows up honestly in scoring and feedback.
  function handleSkip() {
    stopVoiceActivity();
    if (checkingFollowUp || !currentQuestion) return;

    const wasFollowUp = !!activeFollowUp;
    const updatedAnswers = [
      ...answers,
      {
        category: currentQuestion.category,
        question: currentQuestion.question,
        answer: "(skipped by candidate)",
      },
    ];
    setAnswers(updatedAnswers);
    setCurrentAnswer("");

    if (wasFollowUp) {
      setActiveFollowUp(null);
    }

    advanceToNextMainQuestion(updatedAnswers);
  }

  async function scoreInterview(finalAnswers: Answer[]) {
    setScoring(true);
    setScoreError("");
    setScoreResult(null);

    try {
      const res = await fetch("/api/score-interview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ answers: finalAnswers, interviewId }),
      });

      const data = await res.json();

      if (!res.ok) {
        setScoreError(data.error || "Something went wrong scoring your interview.");
        return;
      }

      setScoreResult(data);
    } catch (err) {
      setScoreError("Failed to reach the server for scoring.");
    } finally {
      setScoring(false);
    }
  }

  // ---------- LOADING ----------
  if (stage === "loading") {
    return (
      <main className="min-h-screen bg-background flex items-center justify-center">
        <p className="text-muted-foreground">Loading interview...</p>
      </main>
    );
  }

  // ---------- NOT FOUND ----------
  if (stage === "notfound") {
    return (
      <main className="min-h-screen bg-background flex items-center justify-center px-4">
        <Card className="max-w-md w-full">
          <CardContent className="py-10 text-center space-y-2">
            <p className="text-lg font-heading font-semibold text-foreground">
              Interview not found
            </p>
            <p className="text-muted-foreground text-sm">
              This link may be invalid or the interview may have been removed.
            </p>
          </CardContent>
        </Card>
      </main>
    );
  }

  // ---------- INTRO ----------
  if (stage === "intro") {
    return (
      <main className="min-h-screen bg-background flex items-center justify-center px-4">
        <Card className="max-w-lg w-full overflow-hidden pt-0">
          <div className="flex gap-1.5 px-6 pt-4 pb-2">
            {Array.from({ length: 8 }).map((_, i) => (
              <div
                key={i}
                className="w-1.5 h-1.5 rounded-full bg-background border border-border"
              />
            ))}
          </div>
          <CardHeader>
            <p className="label-mono mb-1">
              {isPractice ? "Practice mode" : "Admit one candidate"}
            </p>
            <CardTitle>
              {isPractice
                ? "Your practice interview is ready"
                : "You've been invited to an interview"}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {isPractice && (targetRole || targetCompany) && (
              <p className="label-mono">
                {targetRole}
                {targetCompany && ` · ${targetCompany}`}
                {targetLevel && ` · ${targetLevel}`}
              </p>
            )}
            <p className="text-muted-foreground">
              This is an AI-conducted practice interview with {questions.length} questions
              covering CS fundamentals, DSA, your projects, and behavioral topics. Answer
              each question in your own words — you&apos;ll get AI-scored feedback at the end.
              {isPractice && " This session isn't tracked by any recruiter."}
            </p>
            {voiceSupported && (
              <label className="flex items-center gap-2 text-sm text-muted-foreground">
                <input
                  type="checkbox"
                  checked={voiceEnabled}
                  onChange={toggleVoiceEnabled}
                  className="h-4 w-4 accent-foreground"
                />
                Read questions aloud
              </label>
            )}

            {!isPractice && (
              <ResumeUpload
                onExtracted={(text) => setResumeText(text)}
                onClear={() => setResumeText(null)}
              />
            )}

            {personalizeError && (
              <p className="flex items-center gap-1.5 text-sm text-destructive">
                <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                {personalizeError}
              </p>
            )}

            <Button
              onClick={handleBeginWithPersonalization}
              disabled={personalizing}
              className="w-full"
            >
              {personalizing && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {personalizing
                ? "Personalizing your questions..."
                : resumeText
                ? "Begin Interview (personalized)"
                : "Begin Interview"}
            </Button>
          </CardContent>
        </Card>
      </main>
    );
  }

  // ---------- INTERVIEW ----------
  if (stage === "interview") {
    const current = currentQuestion;
    const progress = `Q${String(currentIndex + 1).padStart(2, "0")} / ${String(
      questions.length
    ).padStart(2, "0")}`;

    return (
      <main className="min-h-screen bg-background px-4 py-12">
        <div className="mx-auto max-w-2xl space-y-6">
          <div className="text-center space-y-1">
            <p className="label-mono">
              {progress}
              {activeFollowUp && " · follow-up"}
            </p>
            <h1 className="text-2xl">Interview in Progress</h1>
          </div>

          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Badge variant="secondary" className="w-fit font-mono text-xs">
                    {current.category}
                  </Badge>
                  {activeFollowUp && (
                    <Badge
                      variant="outline"
                      className="w-fit border-border text-muted-foreground font-mono text-xs"
                    >
                      Follow-up
                    </Badge>
                  )}
                </div>

                {voiceSupported && (
                  <div className="flex items-center gap-1">
                    {isSpeaking && (
                      <span className="flex items-center gap-1 text-xs text-verified mr-1">
                        <span className="relative flex h-2 w-2">
                          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-verified opacity-75" />
                          <span className="relative inline-flex rounded-full h-2 w-2 bg-verified" />
                        </span>
                        Speaking...
                      </span>
                    )}
                    <button
                      type="button"
                      onClick={replayQuestion}
                      title="Replay question"
                      className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted"
                    >
                      <RotateCcw className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      onClick={toggleVoiceEnabled}
                      title={voiceEnabled ? "Mute AI voice" : "Unmute AI voice"}
                      className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted"
                    >
                      {voiceEnabled ? (
                        <Volume2 className="h-4 w-4" />
                      ) : (
                        <VolumeX className="h-4 w-4" />
                      )}
                    </button>
                  </div>
                )}
              </div>
              <CardTitle className="pt-2 text-xl">{current.question}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="relative">
                <Textarea
                  placeholder={
                    micSupported
                      ? "Type your answer, or tap the mic to speak it..."
                      : "Type your answer here..."
                  }
                  value={currentAnswer}
                  onChange={(e) => setCurrentAnswer(e.target.value)}
                  rows={6}
                  autoFocus
                />
                {micSupported && (
                  <button
                    type="button"
                    onClick={toggleListening}
                    title={isListening ? "Stop recording" : "Answer by voice"}
                    className={`absolute bottom-3 right-3 h-9 w-9 rounded-full flex items-center justify-center transition-colors ${
                      isListening
                        ? "bg-destructive text-background"
                        : "bg-foreground text-background hover:bg-foreground/80"
                    }`}
                  >
                    {isListening ? (
                      <span className="relative flex items-center justify-center h-full w-full">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-destructive opacity-60" />
                        <Mic className="h-4 w-4 relative" />
                      </span>
                    ) : (
                      <Mic className="h-4 w-4" />
                    )}
                  </button>
                )}
              </div>

              {isListening && (
                <div className="flex items-center gap-1 justify-center">
                  {[0, 1, 2, 3, 4].map((i) => (
                    <span
                      key={i}
                      className="w-1 bg-destructive rounded-full animate-pulse"
                      style={{
                        height: `${8 + (i % 3) * 6}px`,
                        animationDelay: `${i * 0.12}s`,
                      }}
                    />
                  ))}
                  <span className="label-mono text-destructive ml-2">Listening...</span>
                </div>
              )}

              {!micSupported && (
                <p className="label-mono text-center">
                  Voice input isn&apos;t supported in this browser — please type your answer.
                </p>
              )}

              {checkingFollowUp && (
                <p className="label-mono text-center animate-pulse">
                  Thinking about a follow-up question...
                </p>
              )}

              <Button onClick={handleNext} className="w-full" disabled={checkingFollowUp}>
                {checkingFollowUp
                  ? "One moment..."
                  : activeFollowUp
                  ? "Submit Follow-up"
                  : currentIndex + 1 < questions.length
                  ? "Next Question"
                  : "Finish Interview"}
              </Button>

              <button
                type="button"
                onClick={handleSkip}
                disabled={checkingFollowUp}
                className="w-full text-center label-mono text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50"
              >
                Skip this question →
              </button>
            </CardContent>
          </Card>
        </div>
      </main>
    );
  }

  // ---------- SUMMARY ----------
  return (
    <main className="min-h-screen bg-background px-4 py-12">
      <div className="mx-auto max-w-3xl space-y-8">
        <div className="text-center space-y-2">
          <p className="label-mono">Interview complete</p>
          <h1 className="text-3xl">
            {scoring ? "Scoring your responses..." : "Here's your performance breakdown"}
          </h1>
        </div>

        {scoring && (
          <Card>
            <CardContent className="py-10 text-center text-muted-foreground">
              Analyzing your answers, please wait...
            </CardContent>
          </Card>
        )}

        {scoreError && (
          <Card>
            <CardContent className="py-6 text-center text-destructive">
              {scoreError}
            </CardContent>
          </Card>
        )}

        {scoreResult && (
          <>
            <Card className="relative overflow-hidden">
              <CardHeader>
                <CardTitle>Overall Score</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground">{scoreResult.overall_feedback}</p>
              </CardContent>

              <div
                className="w-20 h-20 absolute top-4 right-4 flex items-center justify-center"
                style={{
                  background: scoreColor(scoreResult.overall_score),
                  borderRadius: "42% 58% 63% 37% / 41% 44% 56% 59%",
                  transform: "rotate(-8deg)",
                }}
              >
                <span
                  className="font-mono text-sm font-medium text-center leading-tight text-background"
                  style={{ transform: "rotate(8deg)" }}
                >
                  {scoreResult.overall_score}
                  <br />
                  <span className="text-[9px]">/10</span>
                </span>
              </div>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Detailed Feedback</CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                {scoreResult.answers.map((a, i) => (
                  <div
                    key={i}
                    className="border-b border-border pb-6 last:border-none last:pb-0 space-y-2"
                  >
                    <div className="flex items-center justify-between gap-4">
                      <p className="font-medium text-foreground">{a.question}</p>
                      <span className={`font-mono text-sm font-medium shrink-0 ${scoreTextClass(a.score)}`}>
                        {a.score}
                        <span className="text-muted-foreground text-xs"> /10</span>
                      </span>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      <span className="label-mono text-verified">Strengths </span>
                      <br />
                      {a.strengths}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      <span className="label-mono text-seal">Improve </span>
                      <br />
                      {a.improvements}
                    </p>
                  </div>
                ))}
              </CardContent>
            </Card>

            <Button
              onClick={() =>
                (window.location.href = scoreResult.sessionId
                  ? `/interview/${interviewId}/coding?session=${scoreResult.sessionId}`
                  : `/interview/${interviewId}/coding`)
              }
              className="w-full"
            >
              Continue to Coding Round →
            </Button>
          </>
        )}
      </div>
    </main>
  );
}