// TARGET PATH: app/interview/[id]/page.tsx
"use client";

import { useState, useEffect, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
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
import { MeetingModeCall } from "@/components/interview/meeting-mode-call";
import { MeetingHandoff } from "@/components/interview/meeting-handoff";
import { useTextToSpeech } from "@/lib/voice/useTextToSpeech";
import { useAudioLevel } from "@/lib/voice/useAudioLevel";
import { useNetworkInfo } from "@/lib/voice/useNetworkInfo";
import { useVoiceCapture } from "@/lib/voice/useVoiceCapture";
import { formatElapsed, saveMeetingSession, useElapsedSeconds } from "@/lib/meeting-session";
import { toDisplayScore } from "@/lib/scoring";
import { getInterviewerRole, PANEL_ROLE_LABELS, type InterviewerRole } from "@/lib/panel-mode";

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

// "handoff" is meeting-mode only: the in-call beat between the Q&A round and
// the coding round, while scoring runs in the background. Classic mode goes
// straight from "interview" to "summary" as it always has.
type Stage = "loading" | "intro" | "interview" | "handoff" | "summary" | "notfound";

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

// Meeting-mode elapsed-time display lives in lib/meeting-session.ts — the
// coding round shows the same clock, driven off the same start timestamp.

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

// What the interviewer says on the between-rounds screen. Scripted rather than
// generated — it's pure stagecraft, so there's no reason to spend an AI call or
// make the candidate wait on one.
const HANDOFF_LINE =
  "That wraps up the discussion round. Let's move on to a short coding exercise — I'll share a problem on my screen in just a moment.";

export default function CandidateInterview() {
  const params = useParams();
  const interviewId = params.id as string;
  const router = useRouter();

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
  // Set only for practice-mode interviews (candidate picks it on /practice).
  // Recruiter-shared interviews leave this null, and generate-followup /
  // score-interview both fall back to a neutral default when it's absent.
  const [interviewerPersonality, setInterviewerPersonality] = useState<string | null>(null);
  // Opt-in panel mode (two alternating interviewers) — set from the
  // interview's is_panel_mode column, practice-mode only.
  const [isPanelMode, setIsPanelMode] = useState(false);

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
  const [voiceEnabled, setVoiceEnabled] = useState(true); // auto-read questions aloud
  const [cameraEnabled, setCameraEnabled] = useState(true); // self-view during the interview, never recorded
  // Live-meeting-call skin (Phase 14): dark video-call layout. The question
  // is delivered by voice with a progressive caption (no separate "question
  // card"); the answer is captured by voice by default, with an optional
  // typed-answer panel for when the candidate prefers to type. Forces voice
  // + camera on since the mode is meaningless without them.
  const [meetingMode, setMeetingMode] = useState(false);
  // Mic auto-listen toggle, meeting-mode only — ON by default. When on, the
  // mic starts listening automatically the moment the interviewer finishes
  // speaking (see the tts.isSpeaking watcher effect below).
  const [micAutoOn, setMicAutoOn] = useState(true);
  // Meeting-mode only — reveals a plain textarea below the call area so the
  // candidate can type instead of / in addition to speaking.
  const [showTypedAnswer, setShowTypedAnswer] = useState(false);
  // Word-boundary count since the CURRENT question started speaking — drives
  // the progressive caption under the interviewer panel. Reset to 0 every
  // time a new question/follow-up starts (see the TTS effect below).
  const [wordsSpokenInQuestion, setWordsSpokenInQuestion] = useState(0);
  const [selectedVoiceName, setSelectedVoiceName] = useState("");
  const tts = useTextToSpeech();
  const audioLevel = useAudioLevel();
  // Bumped once per TTS word boundary — drives the avatar's speaking pulse.
  // See components/interviewer-avatar.tsx for why this isn't true lip sync.
  const [speakTick, setSpeakTick] = useState(0);

  // ---------- Dynamic follow-up (Phase 13) state ----------
  const MAX_FOLLOWUPS = 3; // cap total follow-ups per interview (cost + pacing)
  const [activeFollowUp, setActiveFollowUp] = useState<{
    category: string;
    question: string;
  } | null>(null);
  const [followUpCount, setFollowUpCount] = useState(0);
  const [checkingFollowUp, setCheckingFollowUp] = useState(false);

  // ---------- Answer capture (native STT, Whisper fallback, auto-listen) ----------
  // The whole pipeline lives in lib/voice/useVoiceCapture.ts so the coding
  // round's think-aloud narration uses the same implementation instead of a
  // second copy. Auto-listen is meeting-mode only: the keeper restarts the mic
  // whenever the browser drops it, but waits while the interviewer is speaking,
  // while the typed-answer panel is open, or while a follow-up is being fetched.
  const voice = useVoiceCapture({
    getBaseText: () => currentAnswer,
    setText: setCurrentAnswer,
    autoListen: meetingMode && stage === "interview" && micAutoOn,
    autoListenBlocked: tts.isSpeaking || showTypedAnswer || checkingFollowUp,
  });
  const { isListening, transcribing, usingFallback, micSupported, voiceInputSupported } = voice;

  // ---------- Meeting-mode header: elapsed time + network info ----------
  // startedAt is a timestamp rather than a counter so the coding round can
  // resume the SAME clock after the route change (see lib/meeting-session.ts).
  const [callStartedAt, setCallStartedAt] = useState<number | null>(null);
  const elapsedSeconds = useElapsedSeconds(
    callStartedAt,
    stage === "interview" || stage === "handoff"
  );
  const networkInfo = useNetworkInfo();

  // The question actually being shown right now — either the next scripted
  // question, or a follow-up probing the answer just given.
  const currentQuestion = activeFollowUp ?? questions[currentIndex];
  // Panel mode: which of the two interviewers "owns" the current question.
  // Follow-ups inherit their parent question's category (see handleNext),
  // so a technical follow-up always stays with the technical interviewer.
  const activeRole: InterviewerRole = currentQuestion
    ? getInterviewerRole(currentQuestion.category)
    : "technical";
  // Who the candidate is talking to, as shown on the call tiles. Also carried
  // into the coding round via the meeting session so the label doesn't change
  // halfway through the same conversation.
  const callRoleLabel = isPanelMode
    ? PANEL_ROLE_LABELS[activeRole]
    : targetRole || "Interviewer";

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

  // Feature-detect TTS once on mount (must run client-side only). Mic/STT
  // support detection lives inside useVoiceCapture.
  useEffect(() => {
    setVoiceSupported(typeof window !== "undefined" && "speechSynthesis" in window);
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
        setInterviewerPersonality(data.interviewerPersonality || null);
        setIsPanelMode(!!data.isPanelMode);
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

    setWordsSpokenInQuestion(0); // fresh caption for the new question
    voice.resetAutoRestarts(); // fresh mic-retry budget for the new question

    tts.speak(currentQuestion.question, {
      rate: 1,
      voiceName: selectedVoiceName || undefined,
      onBoundary: () => {
        setSpeakTick((t) => t + 1);
        setWordsSpokenInQuestion((w) => w + 1);
      },
    });

    return () => {
      tts.cancel();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stage, currentIndex, activeFollowUp, voiceEnabled, voiceSupported, selectedVoiceName]);

  // Meeting-mode caption fallback: onBoundary above is best-effort — some
  // browser voices never fire word-boundary events at all (see the note in
  // interviewer-avatar.tsx), which would leave the AI caption stuck at 0
  // words forever. This timer advances the caption at a fixed pace purely
  // off tts.isSpeaking, so the caption always completes by the time speech
  // ends regardless of whether boundary events fire. Harmless if boundary
  // events ALSO fire — the caption is clamped to the question's word count.
  useEffect(() => {
    if (!tts.isSpeaking) return;
    const WORDS_PER_SECOND = 2.3; // rough average TTS speaking pace
    const id = setInterval(() => {
      setWordsSpokenInQuestion((w) => w + 1);
    }, 1000 / WORDS_PER_SECOND);
    return () => clearInterval(id);
  }, [tts.isSpeaking]);

  // ---------- Handoff: speak the line, warm the route, then navigate ----------

  // Speak the handoff line on arrival. Separate from the question effect above
  // (which bails once stage leaves "interview") but shares the same caption
  // counter, so the fallback timer covers it too.
  useEffect(() => {
    if (stage !== "handoff") return;
    setWordsSpokenInQuestion(0);
    if (!voiceEnabled || !voiceSupported) return;

    tts.speak(HANDOFF_LINE, {
      rate: 1,
      voiceName: selectedVoiceName || undefined,
      onBoundary: () => {
        setSpeakTick((t) => t + 1);
        setWordsSpokenInQuestion((w) => w + 1);
      },
    });

    return () => {
      tts.cancel();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stage, voiceEnabled, voiceSupported, selectedVoiceName]);

  // Warm the coding route while the interviewer is still talking, so the
  // dark→dark transition doesn't flash a white loading screen.
  useEffect(() => {
    if (stage !== "handoff") return;
    router.prefetch(`/interview/${interviewId}/coding`);
  }, [stage, interviewId, router]);

  // Scoring finished in the background — hand the call over to the coding
  // round. sessionStorage carries the call's details (including startedAt, so
  // the clock keeps counting) and ?meeting=1 is the explicit signal.
  useEffect(() => {
    if (stage !== "handoff" || !scoreResult) return;

    saveMeetingSession(interviewId, {
      cameraEnabled,
      voiceEnabled,
      voiceName: selectedVoiceName || null,
      micAutoOn,
      startedAt: callStartedAt ?? Date.now(),
      roleLabel: callRoleLabel,
    });

    const query = new URLSearchParams({ meeting: "1" });
    if (scoreResult.sessionId) query.set("session", scoreResult.sessionId);
    router.push(`/interview/${interviewId}/coding?${query.toString()}`);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stage, scoreResult]);

  // Stop any speech on unmount. Recognition/recording teardown is owned by
  // useVoiceCapture's own cleanup.
  useEffect(() => {
    return () => {
      tts.cancel();
      audioLevel.stop();
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

  // Phase 11: STT — the mic button transcribes into the same answer string as
  // typing. Cancels TTS first so the interviewer isn't talking over the
  // candidate; everything else is the shared capture pipeline's job.
  function toggleListening() {
    if (!isListening) tts.cancel();
    voice.toggle();
  }

  function stopVoiceActivity() {
    tts.cancel();
    if (isListening) voice.stop();
  }

  // Meeting-mode only — flips the auto-listen mic on/off. Turning it off
  // mid-capture stops the current recording immediately rather than waiting
  // for the question to end.
  function toggleMicAuto() {
    setMicAutoOn((prev) => {
      const next = !prev;
      if (!next && isListening) voice.stop();
      return next;
    });
  }

  // Meeting-mode only — reveals/hides the typed-answer panel. Opening it
  // stops any in-progress voice capture so typed and spoken text can't
  // collide in the same answer.
  function toggleTypedAnswer() {
    setShowTypedAnswer((prev) => {
      const next = !prev;
      if (next && isListening) voice.stop();
      return next;
    });
  }

  function beginInterview() {
    setAnswers([]);
    setCurrentIndex(0);
    setCurrentAnswer("");
    setActiveFollowUp(null);
    setFollowUpCount(0);
    setReviewingIndex(null);
    setCallStartedAt(Date.now());
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
      // Meeting mode never breaks the call to show a score: it holds on the
      // handoff screen while this same scoring request runs, then walks
      // straight into the coding round. Feedback for both rounds comes at the
      // very end. Classic mode keeps showing the summary here as it always has.
      setStage(meetingMode ? "handoff" : "summary");
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
            interviewerPersonality,
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
          interviewerPersonality,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        // `debug` is only populated outside production (see the devErrorDetail
        // helper in /api/score-interview) and carries the underlying SQLSTATE.
        // Log it and append it to the visible message so a DB-side failure is
        // diagnosable without reading server terminal scrollback.
        if (data?.debug) console.error("score-interview failed:", data.debug);
        const debugSuffix = data?.debug?.code
          ? ` [${data.debug.code}${data.debug.message ? `: ${data.debug.message}` : ""}]`
          : "";
        setScoreError((data.error || "Something went wrong scoring your interview.") + debugSuffix);
        return;
      }

      setScoreResult(data);
    } catch (err) {
      setScoreError("Failed to reach the server for scoring.");
    } finally {
      setScoring(false);
    }
  }

  // Handoff escape hatch: scoring failed, and the candidate would rather do the
  // coding round than lose it. Navigating without a sessionId means the coding
  // result has nothing to attach to — no combined report, no PDF — which the
  // handoff screen states plainly before they choose it.
  function continueToCodingWithoutSession() {
    saveMeetingSession(interviewId, {
      cameraEnabled,
      voiceEnabled,
      voiceName: selectedVoiceName || null,
      micAutoOn,
      startedAt: callStartedAt ?? Date.now(),
      roleLabel: callRoleLabel,
    });
    router.push(`/interview/${interviewId}/coding?meeting=1`);
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
        <Card className="max-w-lg w-full overflow-hidden">
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
                {isPanelMode && " · Panel mode"}
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

            {voiceSupported && voiceInputSupported && (
              <label className="flex items-start gap-2 text-sm text-muted-foreground">
                <input
                  type="checkbox"
                  checked={meetingMode}
                  onChange={(e) => {
                    const enabled = e.target.checked;
                    setMeetingMode(enabled);
                    // Meaningless without both — force them on so the toggle
                    // never leaves the candidate in a half-configured state.
                    if (enabled) {
                      setVoiceEnabled(true);
                      setCameraEnabled(true);
                    }
                  }}
                  className="h-4 w-4 mt-0.5 accent-foreground"
                />
                <span>
                  Live meeting mode — full-screen video-call view. The question is
                  only ever asked aloud, never shown as text.
                </span>
              </label>
            )}

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

  // ---------- HANDOFF (meeting mode only) ----------
  // Held only as long as Q&A scoring takes; the effect above navigates to the
  // coding round the moment it lands.
  if (stage === "handoff") {
    return (
      <MeetingHandoff
        elapsedLabel={formatElapsed(elapsedSeconds)}
        networkInfo={networkInfo}
        roleLabel={callRoleLabel}
        lineText={HANDOFF_LINE}
        revealedWordCount={wordsSpokenInQuestion}
        avatarState={tts.isSpeaking ? "speaking" : "idle"}
        speakTick={speakTick}
        micLevel={audioLevel.level}
        cameraEnabled={cameraEnabled}
        scoring={scoring}
        scoreError={scoreError}
        onRetry={() => scoreInterview(answers)}
        onContinueWithoutReport={continueToCodingWithoutSession}
      />
    );
  }

  // ---------- INTERVIEW ----------
  if (stage === "interview") {
    const current = currentQuestion;

    if (meetingMode && current) {
      return (
        <MeetingModeCall
          category={current.category}
          roleLabel={callRoleLabel}
          isFollowUp={!!activeFollowUp}
          questionIndex={currentIndex}
          totalQuestions={questions.length}
          questionText={current.question}
          revealedWordCount={wordsSpokenInQuestion}
          avatarState={tts.isSpeaking ? "speaking" : isListening ? "listening" : "idle"}
          micLevel={audioLevel.level}
          speakTick={speakTick}
          cameraEnabled={cameraEnabled}
          voiceInputSupported={voiceInputSupported}
          isListening={isListening}
          usingFallback={usingFallback}
          transcribing={transcribing}
          micAutoOn={micAutoOn}
          onToggleMicAuto={toggleMicAuto}
          liveAnswerTranscript={currentAnswer}
          showTypedAnswer={showTypedAnswer}
          onToggleTypedAnswer={toggleTypedAnswer}
          onAnswerChange={setCurrentAnswer}
          voiceEnabled={voiceEnabled}
          onToggleVoice={toggleVoiceEnabled}
          onReplay={replayQuestion}
          elapsedLabel={formatElapsed(elapsedSeconds)}
          networkInfo={networkInfo}
          checkingFollowUp={checkingFollowUp}
          nextLabel={
            checkingFollowUp
              ? "One moment..."
              : activeFollowUp
              ? "Submit Follow-up"
              : currentIndex + 1 < questions.length
              ? "Next Question"
              : "Finish Interview"
          }
          onNext={handleNext}
          onSkip={handleSkip}
        />
      );
    }

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
                isPanelMode ? (
                  <div className="flex gap-3">
                    {(["technical", "behavioral"] as InterviewerRole[]).map((role) => {
                      const isActive = role === activeRole;
                      return (
                        <div
                          key={role}
                          className={`rounded-md border flex flex-col items-center justify-center px-3 py-2 transition-all duration-300 ${
                            isActive
                              ? "border-seal bg-muted opacity-100 scale-100"
                              : "border-border bg-muted/40 opacity-50 scale-95"
                          }`}
                          style={{ width: 150, height: 190 }}
                        >
                          <InterviewerAvatar
                            state={isActive ? (tts.isSpeaking ? "speaking" : isListening ? "listening" : "idle") : "idle"}
                            micLevel={isActive ? audioLevel.level : 0}
                            speakTick={isActive ? speakTick : 0}
                            surfaceClassName={isActive ? "fill-muted" : "fill-muted/40"}
                            size={80}
                          />
                          <p
                            className={`label-mono mt-1 text-center leading-tight ${
                              isActive ? "text-seal" : "text-muted-foreground/50"
                            }`}
                          >
                            {PANEL_ROLE_LABELS[role]}
                          </p>
                        </div>
                      );
                    })}
                  </div>
                ) : (
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
                )
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
                  {isPanelMode && (
                    <Badge variant="outline" className="w-fit border-seal text-seal font-mono text-xs">
                      {PANEL_ROLE_LABELS[activeRole]}
                    </Badge>
                  )}
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