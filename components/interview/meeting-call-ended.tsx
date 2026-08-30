// TARGET PATH: components/interview/meeting-call-ended.tsx
"use client";

import { PhoneOff } from "lucide-react";
import { InterviewerAvatar } from "@/components/interviewer-avatar";
import { MEETING_PRIMARY_BUTTON } from "@/components/interview/meeting-shell";

interface MeetingCallEndedProps {
  // Frozen at submit time — this is how long the meeting ran, not a clock.
  elapsedLabel: string;
  roleLabel: string;

  lineText: string;
  revealedWordCount: number;
  avatarState: "idle" | "listening" | "speaking";
  speakTick: number;

  reportReady: boolean;
  onViewReport: () => void;
}

// The hang-up screen. Deliberately not built on MeetingShell: there's no live
// call left to put chrome around — no Live pill, no network stats, no controls.
// Just the closing line and the way out.
export function MeetingCallEnded({
  elapsedLabel,
  roleLabel,
  lineText,
  revealedWordCount,
  avatarState,
  speakTick,
  reportReady,
  onViewReport,
}: MeetingCallEndedProps) {
  const words = lineText ? lineText.split(" ") : [];
  const revealedCaption = words.slice(0, revealedWordCount).join(" ");

  return (
    <main className="min-h-screen w-full bg-black text-white flex flex-col items-center justify-center px-6 py-12 gap-8">
      <div className="flex flex-col items-center gap-4 text-center">
        <div className="h-14 w-14 rounded-full border border-neutral-800 bg-neutral-950 flex items-center justify-center">
          <PhoneOff className="h-5 w-5 text-neutral-500" />
        </div>
        <div className="space-y-1">
          <p className="text-2xl">Call ended</p>
          <p className="font-mono tabular-nums text-sm text-neutral-500">{elapsedLabel}</p>
        </div>
      </div>

      <div className="flex flex-col items-center gap-3 text-center max-w-lg">
        <InterviewerAvatar
          state={avatarState}
          micLevel={0}
          speakTick={speakTick}
          surfaceClassName="fill-black"
          size={88}
        />
        <span className="rounded-full border border-neutral-800 px-3 py-1 text-[10px] text-neutral-400">
          {roleLabel}
        </span>
        {/* min-h keeps the button from jumping as the caption fills in */}
        <p className="text-sm text-neutral-300 leading-relaxed min-h-10">{revealedCaption}</p>
      </div>

      <button type="button" onClick={onViewReport} className={MEETING_PRIMARY_BUTTON}>
        View your report →
      </button>

      {!reportReady && (
        <p className="text-[11px] text-neutral-600">Still putting your feedback together…</p>
      )}
    </main>
  );
}
