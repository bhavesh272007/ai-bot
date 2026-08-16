// TARGET PATH: app/interview/[id]/page.tsx
"use client";

import { useState, useEffect, useRef } from "react";
import { useParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Mic, Volume2, VolumeX, RotateCcw, Loader2, AlertCircle } from "lucide-react";
import { ResumeUpload } from "@/components/resume-upload";
import { InterviewerAvatar } from "@/components/interviewer-avatar";
import { CandidateCamera } from "@/components/candidate-camera";
import { InterviewProgress } from "@/components/interview/InterviewProgress";
import { useTextToSpeech } from "@/lib/voice/useTextToSpeech";
import { useAudioLevel } from "@/lib/voice/useAudioLevel";
import { toDisplayScore } from "@/lib/scoring";

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

function isValidEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

// Ranks voices for the picker's default ordering — Indian English first
// (this is where free browser TTS is actually strong, notably Edge's
// neural "Neerja"/"Prabhat" voices), then other English, then the rest.
function voiceRank(v: SpeechSynthesisVoice): number {
  if (v.lang === "en-IN") return 0;
  if (v.lang.startsWith("en")) return 1;
  return 2;
}

function formatVoiceLabel(v: SpeechSynthesisVoice): string {
  return `${v.name} (${v.lang})`;
}

const VOICE_PREFERENCE_KEY = "interview-booth-voice-name";

export default function CandidateInterview() {
  const params = useParams();
  const interviewId = params.id as string;

  const [stage, setStage] = useState<Stage>("loading");
  const [questions, setQuestions] = useState<Question[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [currentAnswer, setCurrentAnswer] = useState("");
  const [answers, setAnswers] = useState<Answer[]>([]);
  // Index into `questions` the candidate is currently reviewing (view-only —
  // navigator lets them glance back at a past answer, not edit it).
  const [reviewingIndex, setReviewingIndex] = useState<number | null>(null);

  const [scoring, setScoring] = useState(false);
  const [scoreResult, setScoreResult] = useState<ScoreResult | null>(null);
  const [scoreError, setScoreError] = useState("");

  // ---------- Self-practice context (no recruiter link) ----------
  const [isPractice, setIsPractice] = useState(false);
  const [targetRole, setTargetRole] = useState("");
  const [targetCompany, setTargetCompany] = useState("");
  const [targetLevel, setTargetLevel] = useState("");

  // ---------- Candidate identity (recruiter-shared interviews only) ----------
  // Self-reported — lets the recruiter dashboard group multiple attempts by
  // the same candidate and show a trend. Not collected in practice mode,
  // since those sessions aren't tracked by any recruiter.
  const [candidateName, setCandidateName] = useState("");
  const [candidateEmail, setCandidateEmail] = useState("");
  const [candidateEmailError, setCandidateEmailError] = useState("");

  // ---------- Resume personalization (recruiter-shared interviews only) ----------
  const [resumeText, setResumeText] = useState<string | null>(null);
  const [personalizing, setPersonalizing] = useState(false);
  const [personalizeError, setPersonalizeError] = useState("");

  // ---------- Voice (STT + TTS) state ----------
  const [voiceSupported, setVoiceSupported] = useState(false);
  const [micSupported, setMicSupported] = useState(false); // native SpeechRecognition present
  // True if we can capture voice at ALL, either via native recognition or
  // via record+Whisper fallback. Gates whether the mic button shows.
  const [voiceInputSupported, setVoiceInputSupported] = useState(false);
  const [voiceEnabled, setVoiceEnabled] = useState(true); // auto-read questions aloud
  const [cameraEnabled, setCameraEnabled] = useState(true); // self-view during the interview, never recorded
  const [selectedVoiceName, setSelectedVoiceName] = useState("");
  const tts = useTextToSpeech();
  const audioLevel = useAudioLevel();
  // Bumped once per TTS word boundary — drives the avatar's speaking pulse.
  // See components/interviewer-avatar.tsx for why this isn't true lip sync.
  const [speakTick, setSpeakTick] = useState(0);
  const [isListening, setIsListening] = useState(false);
  // True while the CURRENT listening session is using record+Whisper
  // instead of live native recognition (no interim transcript in this mode —
  // the answer fills in only once recording stops and Whisper responds).
  const [usingFallback, setUsingFallback] = useState(false);
  const [transcribing, setTranscribing] = useState(false);

  const recognitionRef = useRef<any>(null);
  const baseAnswerRef = useRef(""); // committed transcript before the current listening session
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const activeStreamRef = useRef<MediaStream | null>(null);

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

  // Pick a default voice once the browser reports its list — remembered
  // choice first, otherwise the highest-ranked available (Indian English
  // preferred, since that's where free browser TTS is strongest).
  useEffect(() => {
    if (!tts.isSupported || tts.voices.length === 0 || selectedVoiceName) return;

    const saved = typeof window !== "undefined" ? localStorage.getItem(VOICE_PREFERENCE_KEY) : null;
    if (saved && tts.voices.some((v) => v.name === saved)) {
      setSelectedVoiceName(saved);
      return;
    }

    const [best] = [...tts.voices].sort((a, b) => voiceRank(a) - voiceRank(b));
    if (best) setSelectedVoiceName(best.name);
  }, [tts.voices, tts.isSupported, selectedVoiceName]);

  function handleVoiceChange(name: string) {
    setSelectedVoiceName(name);
    if (typeof window !== "undefined") localStorage.setItem(VOICE_PREFERENCE_KEY, name);
    // Preview it immediately so picking from the dropdown gives instant feedback
    if (currentQuestion && stage === "interview") {
      tts.speak(currentQuestion.question, { voiceName: name, onBoundary: () => setSpeakTick((t) => t + 1) });
    }
  }

  // Drive the avatar's real audio-reactive mouth off genuine mic amplitude
  // while listening — separate from and additive to the existing
  // SpeechRecognition/MediaRecorder logic, which is untouched.
  useEffect(() => {
    if (isListening) {
      audioLevel.start().catch(() => {
        // Best-effort only — if this second getUserMedia call fails for any
        // reason, the avatar just falls back to a resting mouth. The actual
        // answer-capture path (recognition/fallback) is unaffected either way.
      });
    } else {
      audioLevel.stop();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isListening]);

  // Feature-detect once on mount (must run client-side only)
  useEffect(() => {
    setVoiceSupported(typeof window !== "undefined" && "speechSynthesis" in window);
    const SpeechRecognitionCtor =
      typeof window !== "undefined" &&
      ((window as any).SpeechRecognition || (window as any).webkitSpeechRecognition);
    setMicSupported(!!SpeechRecognitionCtor);
    // Voice input is usable either through native recognition, or through
    // plain mic capture + our Whisper fallback endpoint — so this is true
    // for effectively every modern browser, including Firefox.
    setVoiceInputSupported(
      !!SpeechRecognitionCtor ||
        (typeof navigator !== "undefined" && !!navigator.mediaDevices?.getUserMedia)
    );
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

    tts.speak(currentQuestion.question, {
      rate: 1,
      voiceName: selectedVoiceName || undefined,
      onBoundary: () => setSpeakTick((t) => t + 1),
    });

    return () => {
      tts.cancel();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stage, currentIndex, activeFollowUp, voiceEnabled, voiceSupported, selectedVoiceName]);

  // Stop any speech/recognition/recording on unmount
  useEffect(() => {
    return () => {
      tts.cancel();
      audioLevel.stop();
      recognitionRef.current?.stop();
      if (mediaRecorderRef.current?.state === "recording") {
        mediaRecorderRef.current.stop();
      }
      activeStreamRef.current?.getTracks().forEach((t) => t.stop());
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function replayQuestion() {
    if (!voiceSupported || !currentQuestion) return;
    tts.speak(currentQuestion.question, {
      voiceName: selectedVoiceName || undefined,
      onBoundary: () => setSpeakTick((t) => t + 1),
    });
  }

  function toggleVoiceEnabled() {
    if (voiceEnabled) {
      tts.cancel();
    }
    setVoiceEnabled((v) => !v);
  }

  // Record raw audio and send it to our Groq Whisper fallback endpoint.
  // Used for browsers with no native SpeechRecognition (e.g. Firefox), and
  // as a mid-answer rescue if native recognition throws an error.
  async function startFallbackRecording() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      activeStreamRef.current = stream;
      audioChunksRef.current = [];

      const mimeType = MediaRecorder.isTypeSupported("audio/webm") ? "audio/webm" : "audio/mp4";
      const recorder = new MediaRecorder(stream, { mimeType });
      mediaRecorderRef.current = recorder;

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) audioChunksRef.current.push(e.data);
      };

      recorder.onstop = async () => {
        setIsListening(false);
        stream.getTracks().forEach((t) => t.stop());
        activeStreamRef.current = null;

        const blob = new Blob(audioChunksRef.current, { type: mimeType });
        if (blob.size < 1000) return; // essentially silence — nothing worth sending

        setTranscribing(true);
        try {
          const formData = new FormData();
          formData.append("audio", blob, `recording.${mimeType.includes("webm") ? "webm" : "mp4"}`);

          const res = await fetch("/api/transcribe-fallback", { method: "POST", body: formData });
          if (!res.ok) throw new Error("Transcription failed");

          const data = await res.json();
          const text = (data.text || "").trim();
          if (text) {
            setCurrentAnswer((prev) => (prev.trim() ? `${prev.trim()} ${text}` : text));
          }
        } catch (err) {
          // Fail quietly — whatever the candidate already typed/said stays
          // in the box, they can just keep typing or try the mic again.
        } finally {
          setTranscribing(false);
        }
      };

      recorder.start();
      setUsingFallback(true);
      setIsListening(true);
    } catch (err) {
      // Mic permission denied or no device available — nothing more to do.
      setIsListening(false);
    }
  }

  function startNativeRecognition() {
    const SpeechRecognitionCtor =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    const recognition = new SpeechRecognitionCtor();
    recognition.lang = "en-US";
    recognition.continuous = true;
    recognition.interimResults = true;

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

    recognition.onerror = (e: any) => {
      if (e.error === "no-speech" || e.error === "aborted") {
        setIsListening(false);
        return;
      }
      // Something more disruptive (network drop, permission hiccup) —
      // rescue the rest of THIS answer with record+Whisper instead of
      // just dropping the candidate back to typing mid-sentence.
      recognitionRef.current = null;
      setIsListening(false);
      startFallbackRecording();
    };

    recognition.onend = () => {
      if (!usingFallback) setIsListening(false);
    };

    recognitionRef.current = recognition;
    setUsingFallback(false);
    recognition.start();
    setIsListening(true);
  }

  // Phase 11: STT — mic button transcribes into the same textarea as typing.
  // Prefers native SpeechRecognition (live, free, no round-trip); falls back
  // to record+Whisper when native isn't available in this browser.
  function toggleListening() {
    if (!voiceInputSupported) return;

    if (isListening) {
      if (usingFallback) {
        mediaRecorderRef.current?.stop();
      } else {
        recognitionRef.current?.stop();
      }
      return;
    }

    // Don't let the AI talk over the student
    tts.cancel();

    // Keep whatever's already typed/transcribed and append to it
    baseAnswerRef.current = currentAnswer ? currentAnswer.trim() + " " : "";

    if (micSupported) {
      startNativeRecognition();
    } else {
      startFallbackRecording();
    }
  }

  function stopVoiceActivity() {
    tts.cancel();
    if (isListening) {
      if (usingFallback) {
        mediaRecorderRef.current?.stop();
      } else {
        recognitionRef.current?.stop();
      }
    }
  }

  function beginInterview() {
    setAnswers([]);
    setCurrentIndex(0);
    setCurrentAnswer("");
    setActiveFollowUp(null);
    setFollowUpCount(0);
    setReviewingIndex(null);
    setStage("interview");
  }

  // Only relevant for recruiter-shared interviews — practice-mode resume
  // upload already happened at generation time on /practice. This rewrites
  // the LOCAL question list only; the interview's stored `questions` rows
  // (the recruiter's template) are never modified, so other candidates on
  // the same link are unaffected.
  async function handleBeginWithPersonalization() {
    if (!isPractice) {
      const trimmedEmail = candidateEmail.trim();
      if (!trimmedEmail || !isValidEmail(trimmedEmail)) {
        setCandidateEmailError("Enter a valid email — the recruiter uses it to track your attempts.");
        return;
      }
      setCandidateEmailError("");
    }

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
    setReviewingIndex(null);
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
        body: JSON.stringify({
          answers: finalAnswers,
          interviewId,
          candidateEmail: isPractice ? null : candidateEmail.trim().toLowerCase() || null,
          candidateName: isPractice ? null : candidateName.trim() || null,
        }),
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

            {!isPractice && (
              <div className="space-y-3">
                <p className="label-mono">Candidate details</p>
                <div className="space-y-2">
                  <Input
                    type="text"
                    placeholder="Full name"
                    value={candidateName}
                    onChange={(e) => setCandidateName(e.target.value)}
                    autoComplete="name"
                  />
                  <Input
                    type="email"
                    placeholder="Email address"
                    value={candidateEmail}
                    onChange={(e) => {
                      setCandidateEmail(e.target.value);
                      if (candidateEmailError) setCandidateEmailError("");
                    }}
                    autoComplete="email"
                  />
                </div>
                <p className="text-xs text-muted-foreground">
                  Used so the recruiter can match this attempt to you across multiple interviews. Never shown to other candidates.
                </p>
                {candidateEmailError && (
                  <p className="flex items-center gap-1.5 text-sm text-destructive">
                    <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                    {candidateEmailError}
                  </p>
                )}
              </div>
            )}

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

            <label className="flex items-center gap-2 text-sm text-muted-foreground">
              <input
                type="checkbox"
                checked={cameraEnabled}
                onChange={() => setCameraEnabled((v) => !v)}
                className="h-4 w-4 accent-foreground"
              />
              Show my webcam during the interview (for a realistic feel — never recorded or stored)
            </label>

            {voiceSupported && voiceEnabled && tts.voices.length > 0 && (
              <div className="space-y-1">
                <label className="label-mono">Interviewer voice</label>
                <select
                  value={selectedVoiceName}
                  onChange={(e) => handleVoiceChange(e.target.value)}
                  className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground"
                >
                  {[...tts.voices]
                    .filter((v) => v.lang.toLowerCase().startsWith("en"))
                    .sort((a, b) => voiceRank(a) - voiceRank(b))
                    .map((v) => (
                      <option key={v.name} value={v.name}>
                        {formatVoiceLabel(v)}
                      </option>
                    ))}
                </select>
                <p className="text-xs text-muted-foreground">
                  Available voices depend on your browser — Microsoft Edge offers natural-sounding
                  Indian English voices at no cost. Other browsers may only offer a generic voice.
                </p>
              </div>
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

    return (
      <main className="min-h-screen bg-background px-4 py-12">
        <div className="mx-auto max-w-2xl space-y-6">
          <div className="text-center space-y-1">
            <h1 className="text-2xl">Interview in Progress</h1>
          </div>

          <InterviewProgress
            questions={questions}
            currentIndex={currentIndex}
            isFollowUp={!!activeFollowUp}
            answers={answers}
            onSelectReview={setReviewingIndex}
          />

          {reviewingIndex !== null && questions[reviewingIndex] && (
            <Card className="border-seal">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <Badge
                  variant="outline"
                  className="w-fit border-seal text-seal font-mono text-xs"
                >
                  Reviewing Q{reviewingIndex + 1}
                </Badge>
                <button
                  type="button"
                  onClick={() => setReviewingIndex(null)}
                  className="label-mono text-muted-foreground hover:text-foreground transition-colors"
                >
                  Close ✕
                </button>
              </CardHeader>
              <CardContent className="space-y-2">
                <p className="font-medium text-foreground">
                  {questions[reviewingIndex].question}
                </p>
                <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                  {answers.find((a) => a.question === questions[reviewingIndex].question)
                    ?.answer || "(not answered yet)"}
                </p>
              </CardContent>
            </Card>
          )}

          {(voiceSupported && voiceEnabled) || cameraEnabled ? (
            <div className="flex justify-center items-stretch gap-4 flex-wrap">
              {voiceSupported && voiceEnabled && (
                <div
                  className="rounded-md border border-border bg-muted flex flex-col items-center justify-center px-4"
                  style={{ width: 240, height: 180 }}
                >
                  <InterviewerAvatar
                    state={tts.isSpeaking ? "speaking" : isListening ? "listening" : "idle"}
                    micLevel={audioLevel.level}
                    speakTick={speakTick}
                    surfaceClassName="fill-muted"
                    size={110}
                  />
                </div>
              )}
              {cameraEnabled && <CandidateCamera autoStart width={240} height={180} />}
            </div>
          ) : null}

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
                    {tts.isSpeaking && (
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
                    voiceInputSupported
                      ? "Type your answer, or tap the mic to speak it..."
                      : "Type your answer here..."
                  }
                  value={currentAnswer}
                  onChange={(e) => setCurrentAnswer(e.target.value)}
                  rows={6}
                  autoFocus
                />
                {voiceInputSupported && (
                  <button
                    type="button"
                    onClick={toggleListening}
                    disabled={transcribing}
                    title={isListening ? "Stop recording" : "Answer by voice"}
                    className={`absolute bottom-3 right-3 h-9 w-9 rounded-full flex items-center justify-center transition-colors disabled:opacity-50 ${
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
                    ) : transcribing ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
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
                  <span className="label-mono text-destructive ml-2">
                    {usingFallback ? "Recording — tap mic again when done" : "Listening..."}
                  </span>
                </div>
              )}

              {transcribing && !isListening && (
                <p className="label-mono text-center animate-pulse">Transcribing your answer...</p>
              )}

              {!voiceInputSupported && (
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
                  {toDisplayScore(scoreResult.overall_score)}
                  <br />
                  <span className="text-[9px]">/100</span>
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
                        {toDisplayScore(a.score)}
                        <span className="text-muted-foreground text-xs"> /100</span>
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