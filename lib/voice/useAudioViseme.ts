// TARGET PATH: lib/voice/useAudioViseme.ts
"use client";

import { useCallback, useRef, useState } from "react";

/**
 * Standard Speech Viseme Categories (Preston-Blair phoneme-to-viseme system):
 * - rest: mouth closed/relaxed
 * - AH: wide open mouth (vowels: a, ah, aa)
 * - EE: stretched wide smile (vowels: e, ee, i)
 * - OH: rounded mouth (vowels: o, oh, aw)
 * - OO: small circular lips (vowels: u, oo, w)
 * - BMP: lips pressed together (consonants: b, m, p)
 * - FV: lower lip touching upper teeth (consonants: f, v)
 * - TH: tongue hint (th, l)
 */
export type VisemeShape = "rest" | "AH" | "EE" | "OH" | "OO" | "BMP" | "FV" | "TH";

export interface VisemeState {
  shape: VisemeShape;
  openness: number;    // 0.0 (closed) to 1.0 (fully open)
  spread: number;      // 0.5 (narrow rounded) to 1.4 (wide smile)
  jawOffset: number;   // 0 to 12 px vertical jaw displacement
  isSpeaking: boolean;
}

const INITIAL_VISEME: VisemeState = {
  shape: "rest",
  openness: 0,
  spread: 1.0,
  jawOffset: 0,
  isSpeaking: false,
};

// Preston-Blair mapping table from English orthography / phonemes
function charToViseme(char: string, nextChar?: string): { shape: VisemeShape; open: number; spread: number } {
  const c = char.toLowerCase();
  const next = nextChar?.toLowerCase() || "";

  // Bilabial consonants (lips closed)
  if (c === "b" || c === "m" || c === "p") {
    return { shape: "BMP", open: 0.04, spread: 0.95 };
  }

  // Labiodental consonants (lip tuck)
  if (c === "f" || c === "v") {
    return { shape: "FV", open: 0.16, spread: 1.0 };
  }

  // Lingual dental
  if (c === "t" && next === "h") {
    return { shape: "TH", open: 0.22, spread: 1.05 };
  }

  // Rounded Vowels
  if (c === "o") {
    return { shape: "OH", open: 0.65, spread: 0.72 };
  }
  if (c === "u" || c === "w") {
    return { shape: "OO", open: 0.42, spread: 0.6 };
  }

  // Wide Open Vowels
  if (c === "a") {
    return { shape: "AH", open: 0.85, spread: 1.05 };
  }

  // Spread Vowels
  if (c === "e" || c === "i" || c === "y") {
    return { shape: "EE", open: 0.38, spread: 1.32 };
  }

  // Default consonant transition
  return { shape: "rest", open: 0.18, spread: 1.0 };
}

/**
 * Step 1: Real-time Audio Viseme & Lip-Sync Engine
 * Driven by Web Speech boundaries and vowel-cadence interpolation.
 * Produces smooth 60fps jaw, mouth spread, and openness values.
 */
export function useAudioViseme() {
  const [viseme, setViseme] = useState<VisemeState>(INITIAL_VISEME);
  const targetViseme = useRef<VisemeState>(INITIAL_VISEME);
  const rafId = useRef<number | null>(null);
  const decayTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Called continuously at 60fps to interpolate current state smoothly to target
  const startSpringLoop = useCallback(() => {
    if (rafId.current) return;

    const tick = () => {
      setViseme((current) => {
        const target = targetViseme.current;
        // Exponential lerp smoothing for natural human mouth elasticity
        const lerpFactor = target.isSpeaking ? 0.28 : 0.15;
        const nextOpenness = current.openness + (target.openness - current.openness) * lerpFactor;
        const nextSpread = current.spread + (target.spread - current.spread) * lerpFactor;
        const nextJaw = current.jawOffset + (target.jawOffset - current.jawOffset) * lerpFactor;

        return {
          shape: target.shape,
          openness: nextOpenness,
          spread: nextSpread,
          jawOffset: nextJaw,
          isSpeaking: target.isSpeaking,
        };
      });

      rafId.current = requestAnimationFrame(tick);
    };

    rafId.current = requestAnimationFrame(tick);
  }, []);

  // Handler triggered on each spoken word boundary
  const onWordBoundary = useCallback((charIndex: number, fullText: string) => {
    startSpringLoop();

    const char = fullText[charIndex] || "a";
    const nextChar = fullText[charIndex + 1];
    const { shape, open, spread } = charToViseme(char, nextChar);

    // Add subtle natural variation
    const jitter = (Math.random() - 0.5) * 0.08;
    const finalOpen = Math.min(1.0, Math.max(0.1, open + jitter));

    targetViseme.current = {
      shape,
      openness: finalOpen,
      spread,
      jawOffset: finalOpen * 8, // displacement in pixels
      isSpeaking: true,
    };

    // Syllable decay between words
    if (decayTimeout.current) clearTimeout(decayTimeout.current);
    decayTimeout.current = setTimeout(() => {
      targetViseme.current = {
        ...targetViseme.current,
        openness: targetViseme.current.openness * 0.35, // soft close between syllables
        shape: "rest",
      };
    }, 160);
  }, [startSpringLoop]);

  // Handler when speech stops
  const onSpeechEnd = useCallback(() => {
    if (decayTimeout.current) clearTimeout(decayTimeout.current);
    targetViseme.current = INITIAL_VISEME;

    // Give 300ms for spring to settle back to 0, then stop rAF loop
    setTimeout(() => {
      if (rafId.current) {
        cancelAnimationFrame(rafId.current);
        rafId.current = null;
      }
      setViseme(INITIAL_VISEME);
    }, 300);
  }, []);

  return {
    viseme,
    onWordBoundary,
    onSpeechEnd,
  };
}

