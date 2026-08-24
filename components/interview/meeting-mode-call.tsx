// TARGET PATH: components/interview/meeting-mode-call.tsx
"use client";

import { Mic, MicOff, Volume2, VolumeX, RotateCcw, Loader2, Keyboard } from "lucide-react";
import { InterviewerAvatar } from "@/components/interviewer-avatar";
import { CandidateCamera } from "@/components/candidate-camera";

interface NetworkInfo {
  downlinkMbps: number | null;
  rttMs: number | null;
  quality: string | null;
}

interface MeetingModeCallProps {
  category: string;
  roleLabel: string;
  isFollowUp: boolean;
  questionIndex: number;
  totalQuestions: number;

  // Full question text + how many of its words have been spoken so far —
  // drives the progressive caption under the interviewer panel. Not a
  // "question card": it's a live subtitle, revealed in step with the TTS
  // word-boundary events, the same way a real call's captions work.
  questionText: string;
  revealedWordCount: number;

  avatarState: "idle" | "listening" | "speaking";
  micLevel: number;
  speakTick: number;

  cameraEnabled: boolean;

  voiceInputSupported: boolean;
  isListening: boolean;
  usingFallback: boolean;
  transcribing: boolean;

  // Mic auto-listen toggle (on by default) — independent of the momentary
  // isListening state, which reflects whether capture is active right now.
  micAutoOn: boolean;
  onToggleMicAuto: () => void;

  // Shared with the classic layout's answer state — same string whether it
  // arrived via speech-to-text or typing.
  liveAnswerTranscript: string;
  showTypedAnswer: boolean;
  onToggleTypedAnswer: () => void;
  onAnswerChange: (value: string) => void;

  voiceEnabled: boolean;
  onToggleVoice: () => void;
  onReplay: () => void;

  elapsedLabel: string;
  networkInfo: NetworkInfo;

  checkingFollowUp: boolean;
  nextLabel: string;
  onNext: () => void;
  onSkip: () => void;
}

// A self-contained dark "video call" skin for the interview stage —
// deliberately NOT themed off the app's light/Grind Mode tokens, the same
// way a real meeting app stays dark regardless of your OS theme. All the
// actual interview logic (TTS, STT, follow-ups, scoring, elapsed time,
// network stats) stays in the parent page — this component is presentation
// only and takes zero data it doesn't need to render.
export function MeetingModeCall({
  category,
  roleLabel,
  isFollowUp,
  questionIndex,
  totalQuestions,
  questionText,
  revealedWordCount,
  avatarState,
  micLevel,
  speakTick,
  cameraEnabled,
  voiceInputSupported,
  isListening,
  usingFallback,
  transcribing,
  micAutoOn,
  onToggleMicAuto,
  liveAnswerTranscript,
  showTypedAnswer,
  onToggleTypedAnswer,
  onAnswerChange,
  voiceEnabled,
  onToggleVoice,
  onReplay,
  elapsedLabel,
  networkInfo,
  checkingFollowUp,
  nextLabel,
  onNext,
  onSkip,
}: MeetingModeCallProps) {
  const questionWords = questionText ? questionText.split(" ") : [];
  const revealedCaption = questionWords.slice(0, revealedWordCount).join(" ");
  const hasNetworkInfo = networkInfo.quality !== null;

  return (
    <div className="min-h-screen w-full bg-black text-white flex flex-col">
      {/* Top bar — elapsed time is the headline; network stats are secondary
          and only render on browsers that expose navigator.connection. */}
      <div className="grid grid-cols-3 items-center px-6 py-5 gap-2">
        <span className="text-lg font-bold tracking-widest">INTERVIEW BOOTH</span>

        <div className="flex flex-col items-center">
          <span className="text-2xl font-mono tabular-nums tracking-wide">{elapsedLabel}</span>
          <span className="text-[10px] uppercase tracking-widest text-neutral-500">Elapsed</span>
        </div>

        <div className="flex flex-col items-end text-xs text-neutral-400 space-y-1">
          <div className="flex items-center gap-1.5 text-emerald-400">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-400" />
            </span>
            Live
          </div>
          <div>
            Question {questionIndex + 1} of {totalQuestions}
            {isFollowUp && " · Follow-up"}
          </div>
          {hasNetworkInfo && (
            <div className="text-[10px] text-neutral-500">
              {networkInfo.downlinkMbps != null && `${networkInfo.downlinkMbps} Mbps`}
              {networkInfo.rttMs != null && ` · ${networkInfo.rttMs}ms`}
              {` · ${networkInfo.quality}`}
            </div>
          )}
        </div>
      </div>

      {/* Main call area */}
      <div className="flex-1 mx-4 sm:mx-8 mb-4 rounded-2xl border border-neutral-800 bg-neutral-950 p-3 sm:p-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 h-full">
          {/* Candidate panel */}
          <div className="rounded-xl border border-neutral-800 bg-neutral-900 overflow-hidden relative flex items-center justify-center min-h-75 md:min-h-105">
            {cameraEnabled ? (
              <CandidateCamera autoStart width={480} height={420} />
            ) : (
              <p className="text-neutral-600 text-sm">Camera is off</p>
            )}

            {(isListening || transcribing) && (
              <div className="absolute top-3 right-3 flex items-center gap-1.5 rounded-full bg-black/60 px-2.5 py-1">
                {isListening ? (
                  <>
                    <span className="relative flex h-2 w-2">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-500 opacity-60" />
                      <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500" />
                    </span>
                    <span className="text-[10px] text-neutral-200">
                      {usingFallback ? "Recording" : "Listening"}
                    </span>
                  </>
                ) : (
                  <>
                    <Loader2 className="h-3 w-3 animate-spin text-neutral-200" />
                    <span className="text-[10px] text-neutral-200">Transcribing</span>
                  </>
                )}
              </div>
            )}

            {liveAnswerTranscript && (
              <div className="absolute bottom-0 left-0 right-0 bg-linear-to-t from-black/85 to-transparent px-4 pt-8 pb-3">
                <p className="text-sm text-neutral-100 leading-snug line-clamp-3">
                  {liveAnswerTranscript}
                </p>
              </div>
            )}
          </div>

          {/* Interviewer panel — solid bg-slate-900 so InterviewerAvatar's
              eye/mouth cutouts (which match via surfaceClassName) blend
              seamlessly. Glow blobs sit in the corners, away from the
              avatar's center, to keep that blend clean while still giving
              the panel some visual depth. */}
          <div className="rounded-xl border border-neutral-800 overflow-hidden relative flex flex-col items-center justify-center min-h-75 md:min-h-105 bg-slate-900">
            <div className="absolute -top-16 -right-16 w-72 h-72 rounded-full bg-teal-500/10 blur-3xl pointer-events-none" />
            <div className="absolute -bottom-16 -left-16 w-72 h-72 rounded-full bg-blue-600/10 blur-3xl pointer-events-none" />

            <InterviewerAvatar
              state={avatarState}
              micLevel={micLevel}
              speakTick={speakTick}
              surfaceClassName="fill-slate-900"
              size={140}
            />
            <div className="mt-4 flex items-center gap-2 relative">
              <span className="rounded-full border border-neutral-700 px-3 py-1 text-[11px] uppercase tracking-wide text-neutral-300">
                {category}
              </span>
              <span className="rounded-full border border-neutral-700 px-3 py-1 text-[11px] text-neutral-300">
                {roleLabel}
              </span>
            </div>

            {revealedCaption && (
              <div className="absolute bottom-0 left-0 right-0 bg-linear-to-t from-black/85 to-transparent px-4 pt-8 pb-3">
                <p className="text-sm text-neutral-100 leading-snug line-clamp-3">
                  {revealedCaption}
                </p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Typed-answer panel — optional, meeting-mode's alternative to speaking */}
      {showTypedAnswer && (
        <div className="mx-4 sm:mx-8 mb-4">
          <textarea
            value={liveAnswerTranscript}
            onChange={(e) => onAnswerChange(e.target.value)}
            rows={4}
            autoFocus
            placeholder="Type your answer..."
            className="w-full rounded-xl border border-neutral-700 bg-neutral-900 text-white placeholder:text-neutral-600 px-4 py-3 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-white/30"
          />
        </div>
      )}

      <p className="text-center text-[11px] text-neutral-500 mb-4">
        ⓘ For best experience sit in a quiet environment. Your webcam is never recorded or stored.
      </p>

      {/* Controls */}
      <div className="flex items-center justify-center gap-3 pb-8 flex-wrap px-4">
        <button
          type="button"
          onClick={onReplay}
          title="Replay question"
          className="h-11 w-11 rounded-full border border-neutral-700 flex items-center justify-center text-neutral-300 hover:bg-neutral-900"
        >
          <RotateCcw className="h-4 w-4" />
        </button>

        <button
          type="button"
          onClick={onToggleVoice}
          title={voiceEnabled ? "Mute interviewer voice" : "Unmute interviewer voice"}
          className="h-11 w-11 rounded-full border border-neutral-700 flex items-center justify-center text-neutral-300 hover:bg-neutral-900"
        >
          {voiceEnabled ? <Volume2 className="h-4 w-4" /> : <VolumeX className="h-4 w-4" />}
        </button>

        {voiceInputSupported && (
          <button
            type="button"
            onClick={onToggleMicAuto}
            title={micAutoOn ? "Turn mic off" : "Turn mic on"}
            className={`h-11 w-11 rounded-full border flex items-center justify-center transition-colors ${
              micAutoOn
                ? "border-emerald-500 text-emerald-400 bg-emerald-500/10"
                : "border-neutral-700 text-neutral-500 hover:bg-neutral-900"
            }`}
          >
            {micAutoOn ? <Mic className="h-4 w-4" /> : <MicOff className="h-4 w-4" />}
          </button>
        )}

        <button
          type="button"
          onClick={onToggleTypedAnswer}
          title={showTypedAnswer ? "Hide the answer box" : "Type your answer instead"}
          className={`h-11 px-4 rounded-full border flex items-center gap-2 text-sm transition-colors ${
            showTypedAnswer
              ? "border-white bg-white text-black"
              : "border-neutral-700 text-neutral-300 hover:bg-neutral-900"
          }`}
        >
          <Keyboard className="h-4 w-4" />
          Type answer
        </button>

        <button
          type="button"
          onClick={onNext}
          disabled={checkingFollowUp}
          className="rounded-full border border-white px-8 py-3 font-semibold hover:bg-white hover:text-black transition disabled:opacity-40"
        >
          {nextLabel}
        </button>

        <button
          type="button"
          onClick={onSkip}
          disabled={checkingFollowUp}
          className="text-xs text-neutral-500 hover:text-neutral-300 transition-colors disabled:opacity-50 px-2"
        >
          Skip →
        </button>
      </div>
    </div>
  );
}