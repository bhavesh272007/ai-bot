// lib/voice/useLipSync.ts
// Phoneme-driven lip sync using SpeechSynthesis boundary events.
// Produces a normalized "mouth openness" value (0–1) and a vowel shape
// that drives the canvas overlay in <LipSyncCanvas />.

"use client";

import { useCallback, useRef, useState } from "react";

export type MouthShape = "rest" | "A" | "E" | "I" | "O" | "U" | "F" | "B";

// Simple English phoneme → mouth shape map (grapheme level — good enough for
// visual lip sync without a full phoneme engine)
const VOWEL_RE = /[aeiou]/i;
const SHAPE_MAP: Record<string, MouthShape> = {
  a: "A", e: "E", i: "I", o: "O", u: "U",
  b: "B", m: "B", p: "B",       // bilabial — lips together then open
  f: "F", v: "F",                // labiodental
};

function charToShape(ch: string): MouthShape {
  return SHAPE_MAP[ch.toLowerCase()] ?? (VOWEL_RE.test(ch) ? "A" : "rest");
}

// Openness per shape (0 = closed, 1 = wide open)
const OPENNESS: Record<MouthShape, number> = {
  rest: 0.0,
  B:    0.05,
  F:    0.15,
  I:    0.25,
  E:    0.35,
  U:    0.4,
  O:    0.55,
  A:    0.8,
};

// Width stretch per shape (1 = neutral, >1 = wider smile-like)
const WIDTH_STRETCH: Record<MouthShape, number> = {
  rest: 1.0,
  B:    0.9,
  F:    0.95,
  I:    1.3,
  E:    1.2,
  U:    0.75,
  O:    0.7,
  A:    1.05,
};

export interface LipSyncFrame {
  shape: MouthShape;
  openness: number;
  widthStretch: number;
}

export interface UseLipSyncReturn {
  frame: LipSyncFrame;
  onBoundary: (charIndex: number, text: string) => void;
  onSpeechEnd: () => void;
}

const REST_FRAME: LipSyncFrame = { shape: "rest", openness: 0, widthStretch: 1 };

export function useLipSync(): UseLipSyncReturn {
  const [frame, setFrame] = useState<LipSyncFrame>(REST_FRAME);
  const decayTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Called from SpeechSynthesisUtterance.onboundary
  const onBoundary = useCallback((charIndex: number, text: string) => {
    // Look at the first character of the current word to derive the shape
    const ch = text[charIndex] ?? "";
    const shape = charToShape(ch);

    // Briefly boost to wide-open then quickly settle — creates natural animation
    // by varying openness with a tiny jitter for the mid-word characters too
    const jitter = (Math.random() - 0.5) * 0.08; // ±4%
    const openness = Math.max(0, Math.min(1, OPENNESS[shape] + jitter));

    setFrame({ shape, openness, widthStretch: WIDTH_STRETCH[shape] });

    // Decay back toward rest after ~180 ms (inter-word gap)
    if (decayTimer.current) clearTimeout(decayTimer.current);
    decayTimer.current = setTimeout(() => {
      setFrame((prev) => ({
        ...prev,
        openness: prev.openness * 0.4, // partial close, not fully — mid-sentence
      }));
    }, 180);
  }, []);

  const onSpeechEnd = useCallback(() => {
    if (decayTimer.current) clearTimeout(decayTimer.current);
    setFrame(REST_FRAME);
  }, []);

  return { frame, onBoundary, onSpeechEnd };
}
