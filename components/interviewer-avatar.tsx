"use client";

import { useEffect, useState } from "react";
import { AnamAvatar } from "@/components/anam-avatar";

interface InterviewerAvatarProps {
  state: "idle" | "listening" | "speaking";
  sessionToken?: string;
  interviewerName?: string;
  micLevel?: number;
  speakTick?: number;
  surfaceClassName?: string;
  size?: number;
}

export function InterviewerAvatar({
  state,
  sessionToken,
  interviewerName = "Sarah Miller",
  micLevel = 0,
  speakTick = 0,
  surfaceClassName = "fill-background",
  size = 80,
}: InterviewerAvatarProps) {
  if (sessionToken) {
    return (
      <div className="w-full h-full max-w-md mx-auto">
        <AnamAvatar sessionToken={sessionToken} interviewerName={interviewerName} />
      </div>
    );
  }
  const [speakPulse, setSpeakPulse] = useState(false);

  useEffect(() => {
    if (speakTick === 0) return;
    setSpeakPulse(true);
    const t = setTimeout(() => setSpeakPulse(false), 140);
    return () => clearTimeout(t);
  }, [speakTick]);

  const mouthRy =
    state === "listening"
      ? 1.5 + Math.min(1, Math.max(0, micLevel)) * 7
      : state === "speaking" && speakPulse
      ? 6
      : 1.5;

  const label = state === "speaking" ? "Speaking" : state === "listening" ? "Listening" : "Idle";

  return (
    <div className="flex flex-col items-center gap-1.5">
      <svg
        viewBox="0 0 100 100"
        width={size}
        height={size}
        className="text-foreground"
        role="img"
        aria-label={`Interviewer avatar — ${label.toLowerCase()}`}
      >
        {/* shoulders + head — currentColor so it inverts automatically in dark mode */}
        <path d="M28 92 Q28 62 50 62 Q72 62 72 92 Z" fill="currentColor" />
        <circle cx="50" cy="38" r="24" fill="currentColor" />

        {/* eyes — blink via SMIL, no CSS/JS animation loop needed */}
        <ellipse cx="42" cy="34" rx="2" ry="2" className={surfaceClassName}>
          <animate
            attributeName="ry"
            values="2;2;0.3;2"
            keyTimes="0;0.9;0.95;1"
            dur="4.5s"
            repeatCount="indefinite"
          />
        </ellipse>
        <ellipse cx="58" cy="34" rx="2" ry="2" className={surfaceClassName}>
          <animate
            attributeName="ry"
            values="2;2;0.3;2"
            keyTimes="0;0.9;0.95;1"
            dur="4.5s"
            repeatCount="indefinite"
          />
        </ellipse>

        {/* mouth cutout — real amplitude while listening, word-pulse while speaking */}
        <ellipse
          cx="50"
          cy="46"
          rx="7"
          ry={mouthRy}
          className={surfaceClassName}
          style={{ transition: "ry 100ms ease-out" }}
        />
      </svg>
      <p className="label-mono text-muted-foreground/70">{label}</p>
    </div>
  );
}