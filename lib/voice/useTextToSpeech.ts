// lib/voice/useTextToSpeech.ts
"use client";

import { useCallback, useEffect, useRef, useState } from "react";

interface SpeakOptions {
  rate?: number;
  pitch?: number;
  voiceName?: string;
  onBoundary?: (charIndex: number) => void; // for future avatar lip-sync
  onEnd?: () => void;
}

export function useTextToSpeech() {
  const [isSupported, setIsSupported] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);

  useEffect(() => {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
    setIsSupported(true);

    const loadVoices = () => setVoices(window.speechSynthesis.getVoices());
    loadVoices();
    window.speechSynthesis.onvoiceschanged = loadVoices;

    return () => {
      window.speechSynthesis.onvoiceschanged = null;
    };
  }, []);

  const speak = useCallback(
    (text: string, opts: SpeakOptions = {}) => {
      if (!isSupported) return;

      window.speechSynthesis.cancel(); // stop anything queued

      const utterance = new SpeechSynthesisUtterance(text);
      utterance.rate = opts.rate ?? 1;
      utterance.pitch = opts.pitch ?? 1;

      if (opts.voiceName) {
        const match = voices.find((v) => v.name === opts.voiceName);
        if (match) utterance.voice = match;
      }

      utterance.onstart = () => setIsSpeaking(true);
      utterance.onend = () => {
        setIsSpeaking(false);
        opts.onEnd?.();
      };
      utterance.onerror = () => setIsSpeaking(false);
      utterance.onboundary = (e) => opts.onBoundary?.(e.charIndex);

      utteranceRef.current = utterance;
      window.speechSynthesis.speak(utterance);
    },
    [isSupported, voices]
  );

  const cancel = useCallback(() => {
    if (!isSupported) return;
    window.speechSynthesis.cancel();
    setIsSpeaking(false);
  }, [isSupported]);

  return { speak, cancel, isSpeaking, isSupported, voices };
}