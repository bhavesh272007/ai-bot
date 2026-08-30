// TARGET PATH: components/interview/meeting-tile.tsx
"use client";

import type { ReactNode } from "react";
import { Loader2 } from "lucide-react";

interface MeetingTileProps {
  children: ReactNode;
  // Bottom subtitle overlay — the interviewer's progressive question caption,
  // or the candidate's live transcript. Rendered over a gradient so it stays
  // readable on top of video.
  caption?: string;
  captionClampClass?: string;
  // Top-right status pill.
  statusPill?: ReactNode;
  className?: string;
}

// One "video call" tile: rounded panel, optional status pill, optional bottom
// caption overlay. Shared by the interviewer avatar, the candidate camera, and
// the coding round's think-aloud panel so all three read as the same object.
export function MeetingTile({
  children,
  caption,
  captionClampClass = "line-clamp-3",
  statusPill,
  className = "",
}: MeetingTileProps) {
  return (
    <div
      className={`rounded-xl border border-neutral-800 overflow-hidden relative flex items-center justify-center ${className}`}
    >
      {children}

      {statusPill && <div className="absolute top-3 right-3">{statusPill}</div>}

      {caption && (
        <div className="absolute bottom-0 left-0 right-0 bg-linear-to-t from-black/85 to-transparent px-4 pt-8 pb-3">
          <p className={`text-sm text-neutral-100 leading-snug ${captionClampClass}`}>{caption}</p>
        </div>
      )}
    </div>
  );
}

// The mic status pill shown on whichever tile represents the candidate.
// `null` when nothing is happening, so tiles stay clean while idle.
export function MicStatusPill({
  isListening,
  transcribing,
  usingFallback,
}: {
  isListening: boolean;
  transcribing: boolean;
  usingFallback: boolean;
}) {
  if (!isListening && !transcribing) return null;

  return (
    <div className="flex items-center gap-1.5 rounded-full bg-black/60 px-2.5 py-1">
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
  );
}
