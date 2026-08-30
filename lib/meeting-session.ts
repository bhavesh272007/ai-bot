// TARGET PATH: lib/meeting-session.ts
"use client";

import { useEffect, useState } from "react";

// Meeting mode spans two routes — /interview/[id] (Q&A) and
// /interview/[id]/coding — but it's a purely client-side presentation choice,
// so there's nothing worth persisting to the DB. sessionStorage is the right
// scope: it survives the route change and a reload in the same tab, and dies
// with the tab, which is exactly the lifetime of one "meeting".
//
// The URL still carries ?meeting=1 as the explicit signal. This store only
// supplies the *details* (camera/voice prefs, the call's start time). If it's
// missing — cleared storage, a link pasted into a fresh tab — the coding page
// falls back to the plain light layout rather than a half-configured call.

export interface MeetingSessionState {
  cameraEnabled: boolean;
  voiceEnabled: boolean;
  // Chosen TTS voice name. Also mirrored in localStorage by the interview
  // page's own voice picker, but carried here too so the coding round doesn't
  // depend on that separate key having been written.
  voiceName: string | null;
  micAutoOn: boolean;
  // Epoch ms when the interview began. The whole point: the coding round
  // continues ONE elapsed clock rather than restarting at 0:00.
  startedAt: number;
  // "Technical Interviewer" (panel mode), the target role, or "Interviewer".
  roleLabel: string;
}

function storageKey(interviewId: string) {
  return `interview-booth-meeting-${interviewId}`;
}

export function saveMeetingSession(interviewId: string, state: MeetingSessionState) {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.setItem(storageKey(interviewId), JSON.stringify(state));
  } catch {
    // Storage disabled or full — the coding round will just fall back to the
    // classic layout, which is a degraded look, not a broken interview.
  }
}

export function loadMeetingSession(interviewId: string): MeetingSessionState | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(storageKey(interviewId));
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    // Only startedAt is load-bearing (the shared clock) — validate it and let
    // everything else fall back to a sensible default.
    if (typeof parsed?.startedAt !== "number") return null;
    return {
      cameraEnabled: parsed.cameraEnabled !== false,
      voiceEnabled: parsed.voiceEnabled !== false,
      voiceName: typeof parsed.voiceName === "string" ? parsed.voiceName : null,
      micAutoOn: parsed.micAutoOn !== false,
      startedAt: parsed.startedAt,
      roleLabel: typeof parsed.roleLabel === "string" ? parsed.roleLabel : "Interviewer",
    };
  } catch {
    return null;
  }
}

export function clearMeetingSession(interviewId: string) {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.removeItem(storageKey(interviewId));
  } catch {
    // Nothing to do — a stale entry is harmless, it's scoped to this tab.
  }
}

// The call clock, ticking once a second off a shared `startedAt`. Both rounds
// mount their own copy of this — they're separate routes — but because they
// read the same epoch timestamp the clock reads as one continuous meeting
// rather than two sessions.
export function useElapsedSeconds(startedAt: number | null, running: boolean): number {
  const [elapsedSeconds, setElapsedSeconds] = useState(() =>
    startedAt === null ? 0 : Math.max(0, Math.floor((Date.now() - startedAt) / 1000))
  );

  useEffect(() => {
    if (!running || startedAt === null) return;
    // Set immediately so a route change doesn't flash a stale value for a
    // second before the first interval tick lands.
    setElapsedSeconds(Math.max(0, Math.floor((Date.now() - startedAt) / 1000)));
    const id = setInterval(() => {
      setElapsedSeconds(Math.max(0, Math.floor((Date.now() - startedAt) / 1000)));
    }, 1000);
    return () => clearInterval(id);
  }, [startedAt, running]);

  return elapsedSeconds;
}

// Call-clock display — "4:32" under an hour, "1:04:32" past it.
export function formatElapsed(totalSeconds: number): string {
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  const pad = (n: number) => n.toString().padStart(2, "0");
  return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${m}:${pad(s)}`;
}
