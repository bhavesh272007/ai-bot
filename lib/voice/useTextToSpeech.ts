// lib/voice/useTextToSpeech.ts
"use client";

import { useCallback, useEffect, useRef, useState } from "react";

interface SpeakOptions {
  rate?: number;
  pitch?: number;
  voiceName?: string;
  /** Called on each word boundary. Receives charIndex and the full utterance text. */
  onBoundary?: (charIndex: number, text: string) => void;
  onEnd?: () => void;
}

/**
 * Intelligently select a warm, professional voice matching the interviewer persona:
 * Young, poised Indian/global tech hiring lead.
 */
export function selectInterviewerVoice(voices: SpeechSynthesisVoice[]): SpeechSynthesisVoice | null {
  if (!voices || voices.length === 0) return null;

  // 1. Top priority: Natural Indian English female voices (perfect match for persona)
  const indianFemale = voices.find(
    (v) =>
      v.name.includes("Neerja") ||
      v.name.includes("Heera") ||
      (v.lang === "en-IN" && (v.name.includes("Female") || v.name.includes("Natural") || v.name.includes("Google")))
  );
  if (indianFemale) return indianFemale;

  const anyIndianEnglish = voices.find((v) => v.lang === "en-IN" || v.name.includes("India"));
  if (anyIndianEnglish) return anyIndianEnglish;

  // 2. High-fidelity Natural Online voices (Edge/Chrome Natural)
  const naturalFemale = voices.find(
    (v) =>
      (v.name.includes("Natural") || v.name.includes("Online")) &&
      (v.name.includes("Jenny") ||
        v.name.includes("Aria") ||
        v.name.includes("Sonia") ||
        v.name.includes("Ava") ||
        v.name.includes("Emma"))
  );
  if (naturalFemale) return naturalFemale;

  // 3. Google High Quality Voices
  const googleFemale = voices.find(
    (v) =>
      v.name.includes("Google") &&
      (v.name.includes("Female") || v.name.includes("UK English Female") || v.name.includes("US English"))
  );
  if (googleFemale) return googleFemale;

  // 4. Apple / System Natural Female voices
  const appleFemale = voices.find(
    (v) => v.name.includes("Samantha") || v.name.includes("Karen") || v.name.includes("Serena")
  );
  if (appleFemale) return appleFemale;

  // 5. Any English Female voice
  const anyEnglishFemale = voices.find(
    (v) =>
      v.lang.startsWith("en") &&
      (v.name.toLowerCase().includes("female") ||
        v.name.toLowerCase().includes("woman") ||
        v.name.toLowerCase().includes("zira"))
  );
  if (anyEnglishFemale) return anyEnglishFemale;

  // 6. Fallback: Any English voice
  return voices.find((v) => v.lang.startsWith("en")) ?? voices[0] ?? null;
}

export function useTextToSpeech() {
  const [isSupported, setIsSupported] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [selectedVoice, setSelectedVoice] = useState<SpeechSynthesisVoice | null>(null);
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);

  useEffect(() => {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
    setIsSupported(true);

    const loadVoices = () => {
      const available = window.speechSynthesis.getVoices();
      setVoices(available);
      setSelectedVoice(selectInterviewerVoice(available));
    };

    loadVoices();
    window.speechSynthesis.onvoiceschanged = loadVoices;

    return () => {
      window.speechSynthesis.onvoiceschanged = null;
    };
  }, []);

  const speak = useCallback(
    (text: string, opts: SpeakOptions = {}) => {
      if (!isSupported) return;

      window.speechSynthesis.cancel(); // Stop any pending speech

      const utterance = new SpeechSynthesisUtterance(text);
      // Tuning for natural, articulate interviewer delivery
      utterance.rate = opts.rate ?? 0.98;
      utterance.pitch = opts.pitch ?? 1.04;

      if (opts.voiceName) {
        const match = voices.find((v) => v.name === opts.voiceName);
        if (match) utterance.voice = match;
      } else if (selectedVoice) {
        utterance.voice = selectedVoice;
      }

      utterance.onstart = () => setIsSpeaking(true);
      utterance.onend = () => {
        setIsSpeaking(false);
        opts.onEnd?.();
      };
      utterance.onerror = () => setIsSpeaking(false);
      utterance.onboundary = (e) => {
        opts.onBoundary?.(e.charIndex, text);
      };

      utteranceRef.current = utterance;
      window.speechSynthesis.speak(utterance);
    },
    [isSupported, voices, selectedVoice]
  );

  const cancel = useCallback(() => {
    if (!isSupported) return;
    window.speechSynthesis.cancel();
    setIsSpeaking(false);
  }, [isSupported]);

  return { speak, cancel, isSpeaking, isSupported, voices, selectedVoice };
}