// TARGET PATH: components/interview/meeting-shell.tsx
"use client";

import type { ReactNode } from "react";
import type { NetworkInfo } from "@/lib/voice/useNetworkInfo";

interface MeetingShellProps {
  // Right-hand header line under the Live pill — "Question 3 of 8 · Follow-up"
  // during Q&A, "Coding round" once the interviewer shares their screen.
  stageLabel: string;
  elapsedLabel: string;
  networkInfo: NetworkInfo;

  // The stage area. Callers own their own margins/padding so each round can
  // lay itself out freely — the shell only guarantees it sits between the
  // header and the control bar and gets the leftover vertical space.
  children: ReactNode;

  // Control bar contents (buttons). Omitted on screens with no controls,
  // e.g. the between-rounds handoff.
  controls?: ReactNode;

  // Defaults to the privacy note both rounds show. Pass null to hide it.
  footnote?: ReactNode;

  // Q&A grows with its content (min-h-screen); the coding round pins itself to
  // the viewport so the editor and console scroll internally instead of the
  // whole page scrolling the call chrome off-screen.
  lockViewport?: boolean;
}

const DEFAULT_FOOTNOTE =
  "ⓘ For best experience sit in a quiet environment. Your webcam is never recorded or stored.";

// The call chrome shared by every meeting-mode screen — header (brand, call
// clock, live/stage/network), stage area, footnote, control bar. Deliberately
// NOT themed off the app's light/Grind Mode tokens, the same way a real
// meeting app stays dark regardless of your OS theme.
export function MeetingShell({
  stageLabel,
  elapsedLabel,
  networkInfo,
  children,
  controls,
  footnote = DEFAULT_FOOTNOTE,
  lockViewport = false,
}: MeetingShellProps) {
  const hasNetworkInfo = networkInfo.quality !== null;

  return (
    <div
      className={`w-full bg-black text-white flex flex-col ${
        lockViewport ? "h-screen overflow-hidden" : "min-h-screen"
      }`}
    >
      {/* Top bar — elapsed time is the headline; network stats are secondary
          and only render on browsers that expose navigator.connection. */}
      <div className="grid grid-cols-3 items-center px-6 py-5 gap-2 shrink-0">
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
          <div>{stageLabel}</div>
          {hasNetworkInfo && (
            <div className="text-[10px] text-neutral-500">
              {networkInfo.downlinkMbps != null && `${networkInfo.downlinkMbps} Mbps`}
              {networkInfo.rttMs != null && ` · ${networkInfo.rttMs}ms`}
              {` · ${networkInfo.quality}`}
            </div>
          )}
        </div>
      </div>

      {children}

      {footnote && (
        <p className="text-center text-[11px] text-neutral-500 mb-4 px-4 shrink-0">{footnote}</p>
      )}

      {controls && (
        <div className="flex items-center justify-center gap-3 pb-8 flex-wrap px-4 shrink-0">
          {controls}
        </div>
      )}
    </div>
  );
}

// Shared control-bar button shapes, so the Q&A and coding rounds can't drift
// apart on sizing or hover treatment.
export const MEETING_ICON_BUTTON =
  "h-11 w-11 rounded-full border border-neutral-700 flex items-center justify-center text-neutral-300 hover:bg-neutral-900 transition-colors disabled:opacity-40";

export const MEETING_PRIMARY_BUTTON =
  "rounded-full border border-white px-8 py-3 font-semibold hover:bg-white hover:text-black transition disabled:opacity-40";

export const MEETING_SECONDARY_BUTTON =
  "rounded-full border border-neutral-700 px-6 py-3 text-sm text-neutral-200 hover:bg-neutral-900 transition disabled:opacity-40";
