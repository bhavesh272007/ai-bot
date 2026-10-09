// TARGET PATH: components/interview/meeting-mode-call.tsx
"use client";

import { Mic, MicOff, Volume2, VolumeX, RotateCcw, Keyboard, Sparkles } from "lucide-react";
import { InterviewerAvatar } from "@/components/interviewer-avatar";
import { AnamAvatar } from "@/components/anam-avatar";
import { CandidateCamera } from "@/components/candidate-camera";
import {
  MeetingShell,
  MEETING_ICON_BUTTON,
  MEETING_PRIMARY_BUTTON,
} from "@/components/interview/meeting-shell";
import { MeetingTile, MicStatusPill } from "@/components/interview/meeting-tile";
import type { NetworkInfo } from "@/lib/voice/useNetworkInfo";

interface MeetingModeCallProps {
  category: string;
  roleLabel: string;
  isFollowUp: boolean;
  questionIndex: number;
  totalQuestions: number;

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

  micAutoOn: boolean;
  onToggleMicAuto: () => void;

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

  anamMode?: boolean;
  anamSessionToken?: string | null;
  anamLoading?: boolean;
  onToggleAnamMode?: () => void;
}

// The dark "video call" skin for the Q&A stage. All the actual interview logic
// (TTS, STT, follow-ups, scoring, elapsed time, network stats) stays in the
// parent page — this component is presentation only and takes zero data it
// doesn't render. The shared call chrome lives in MeetingShell, so this and
// the coding round can't drift apart.
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
  anamMode = false,
  anamSessionToken = null,
  anamLoading = false,
  onToggleAnamMode,
}: MeetingModeCallProps) {
  const questionWords = questionText ? questionText.split(" ") : [];
  const revealedCaption = questionWords.slice(0, revealedWordCount).join(" ");

  return (
    <MeetingShell
      stageLabel={`Question ${questionIndex + 1} of ${totalQuestions}${
        isFollowUp ? " · Follow-up" : ""
      }`}
      elapsedLabel={elapsedLabel}
      networkInfo={networkInfo}
      controls={
        <>
          {onToggleAnamMode && (
            <button
              type="button"
              onClick={onToggleAnamMode}
              title={anamMode ? "Switch to 2D Bot" : "Switch to Anam HD Avatar"}
              className={`h-11 px-3.5 rounded-full border flex items-center gap-1.5 text-xs font-semibold transition-all ${
                anamMode
                  ? "border-indigo-500 bg-indigo-500/25 text-indigo-200 shadow-lg shadow-indigo-500/25 ring-1 ring-indigo-400/50"
                  : "border-neutral-700 text-neutral-300 hover:bg-neutral-900"
              }`}
            >
              <Sparkles className="h-3.5 w-3.5 text-indigo-400 animate-pulse" />
              <span>{anamMode ? "✨ Anam HD Active" : "✨ Switch to Anam HD"}</span>
            </button>
          )}

          <button
            type="button"
            onClick={onReplay}
            title="Replay question"
            className={MEETING_ICON_BUTTON}
          >
            <RotateCcw className="h-4 w-4" />
          </button>

          <button
            type="button"
            onClick={onToggleVoice}
            title={voiceEnabled ? "Mute interviewer voice" : "Unmute interviewer voice"}
            className={MEETING_ICON_BUTTON}
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
            className={MEETING_PRIMARY_BUTTON}
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
        </>
      }
    >
      {/* Main call area */}
      <div className="flex-1 mx-4 sm:mx-8 mb-4 rounded-2xl border border-neutral-800 bg-neutral-950 p-3 sm:p-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 h-full">
          {/* Candidate panel */}
          <MeetingTile
            className="bg-neutral-900 min-h-75 md:min-h-105"
            caption={liveAnswerTranscript}
            statusPill={
              <MicStatusPill
                isListening={isListening}
                transcribing={transcribing}
                usingFallback={usingFallback}
              />
            }
          >
            {cameraEnabled ? (
              <CandidateCamera autoStart width={480} height={420} />
            ) : (
              <p className="text-neutral-600 text-sm">Camera is off</p>
            )}
          </MeetingTile>

          {/* Interviewer panel — solid bg-slate-900 so InterviewerAvatar's
              eye/mouth cutouts (which match via surfaceClassName) blend
              seamlessly. Glow blobs sit in the corners, away from the
              avatar's center, to keep that blend clean while still giving
              the panel some visual depth. */}
          <MeetingTile
            className="flex-col bg-slate-900 min-h-75 md:min-h-105 overflow-hidden"
            caption={revealedCaption}
          >
            <div className="absolute -top-16 -right-16 w-72 h-72 rounded-full bg-teal-500/10 blur-3xl pointer-events-none" />
            <div className="absolute -bottom-16 -left-16 w-72 h-72 rounded-full bg-blue-600/10 blur-3xl pointer-events-none" />

            {anamMode && anamSessionToken ? (
              <div className="w-full h-full flex flex-col items-center justify-center p-2">
                <AnamAvatar sessionToken={anamSessionToken} interviewerName={roleLabel} />
              </div>
            ) : anamMode && anamLoading ? (
              <div className="flex flex-col items-center justify-center gap-3 text-slate-300 py-12">
                <div className="w-12 h-12 rounded-full border-2 border-indigo-500/30 border-t-indigo-500 animate-spin" />
                <span className="text-xs font-medium text-indigo-300">Connecting to Anam HD Avatar...</span>
              </div>
            ) : (
              <>
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
              </>
            )}
          </MeetingTile>
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
    </MeetingShell>
  );
}
