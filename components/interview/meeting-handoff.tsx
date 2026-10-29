// TARGET PATH: components/interview/meeting-handoff.tsx
"use client";

import { Loader2 } from "lucide-react";
import { InterviewerAvatar } from "@/components/interviewer-avatar";
import { CandidateCamera } from "@/components/candidate-camera";
import {
  MeetingShell,
  MEETING_PRIMARY_BUTTON,
  MEETING_SECONDARY_BUTTON,
} from "@/components/interview/meeting-shell";
import { MeetingTile } from "@/components/interview/meeting-tile";
import type { NetworkInfo } from "@/lib/voice/useNetworkInfo";

interface MeetingHandoffProps {
  elapsedLabel: string;
  networkInfo: NetworkInfo;
  roleLabel: string;

  // The handoff line + how much of it has been spoken — same progressive
  // caption mechanic as the Q&A stage.
  lineText: string;
  revealedWordCount: number;

  avatarState: "idle" | "listening" | "speaking";
  speakTick: number;
  micLevel: number;
  cameraEnabled: boolean;

  // Q&A scoring runs in the background while this screen is up. On success the
  // parent navigates; this component only ever shows "still working" or the
  // failure fork.
  scoring: boolean;
  scoreError: string;
  onRetry: () => void;
  onContinueWithoutReport: () => void;
}

// The between-rounds screen. Deliberately NOT a score report: the candidate
// stays in the call, the interviewer says one line, and the coding round opens
// as soon as Q&A scoring finishes in the background. Feedback for both rounds
// arrives together at the very end.
export function MeetingHandoff({
  elapsedLabel,
  networkInfo,
  roleLabel,
  lineText,
  revealedWordCount,
  avatarState,
  speakTick,
  micLevel,
  cameraEnabled,
  scoring,
  scoreError,
  onRetry,
  onContinueWithoutReport,
}: MeetingHandoffProps) {
  const words = lineText ? lineText.split(" ") : [];
  const revealedCaption = words.slice(0, revealedWordCount).join(" ");

  return (
    <MeetingShell
      stageLabel="Between rounds"
      elapsedLabel={elapsedLabel}
      networkInfo={networkInfo}
      footnote={null}
      controls={
        scoreError ? (
          <>
            <button type="button" onClick={onRetry} className={MEETING_PRIMARY_BUTTON}>
              Try again
            </button>
            <button
              type="button"
              onClick={onContinueWithoutReport}
              className={MEETING_SECONDARY_BUTTON}
            >
              Continue to coding round anyway
            </button>
          </>
        ) : null
      }
    >
      <div className="flex-1 flex flex-col items-center justify-center px-4 sm:px-8 pb-6 gap-6">
        {/* One tile, centred — the candidate's own camera drops to a corner
            PiP so the interviewer clearly has the floor for this beat. */}
        <MeetingTile
          className="flex-col bg-slate-900 w-full max-w-3xl min-h-75 md:min-h-105"
          caption={revealedCaption}
        >
          <div className="absolute -top-16 -right-16 w-72 h-72 rounded-full bg-teal-500/10 blur-3xl pointer-events-none" />
          <div className="absolute -bottom-16 -left-16 w-72 h-72 rounded-full bg-blue-600/10 blur-3xl pointer-events-none" />

          {cameraEnabled && (
            <div className="absolute top-3 left-3 rounded-lg overflow-hidden">
              <CandidateCamera autoStart width={144} height={104} />
            </div>
          )}

          <InterviewerAvatar
            state={avatarState}
            micLevel={micLevel}
            speakTick={speakTick}
            surfaceClassName="fill-slate-900"
            size={140}
            fill
            roleLabel={roleLabel}
          />
        </MeetingTile>

        {scoreError ? (
          <div className="w-full max-w-3xl rounded-xl border border-red-900/60 bg-red-950/40 px-5 py-4 space-y-1">
            <p className="text-sm text-red-200">{scoreError}</p>
            <p className="text-xs text-red-300/70">
              Continuing without saving means no combined report and no PDF at the end — the
              coding round itself will still work.
            </p>
          </div>
        ) : (
          <div className="flex items-center gap-2 rounded-full border border-neutral-800 bg-neutral-950 px-4 py-2">
            {scoring && <Loader2 className="h-3.5 w-3.5 animate-spin text-neutral-400" />}
            <span className="text-xs text-neutral-400">Preparing the coding exercise…</span>
          </div>
        )}
      </div>
    </MeetingShell>
  );
}
