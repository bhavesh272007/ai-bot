// lib/voice/useSpeechToText.ts
"use client";

import { useCallback, useEffect, useRef, useState } from "react";

interface UseSpeechToTextResult {
  isListening: boolean;
  transcript: string;
  interimTranscript: string;
  usingFallback: boolean;
  isSupported: boolean;
  error: string | null;
  startListening: (stream?: MediaStream) => Promise<void>;
  stopListening: () => void;
}

// Minimal shape so we don't need @types/dom-speech-recognition
type SpeechRecognitionLike = {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  start: () => void;
  stop: () => void;
  onresult: ((e: any) => void) | null;
  onerror: ((e: any) => void) | null;
  onend: (() => void) | null;
};

function getSpeechRecognition(): (new () => SpeechRecognitionLike) | null {
  if (typeof window === "undefined") return null;
  return (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition || null;
}

export function useSpeechToText(): UseSpeechToTextResult {
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [interimTranscript, setInterimTranscript] = useState("");
  const [usingFallback, setUsingFallback] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Starts false on both server and first client render, then resolves
  // in an effect — avoids a hydration mismatch, since checking browser
  // APIs synchronously during render gives the server and client
  // different answers.
  const [isSupported, setIsSupported] = useState(false);

  useEffect(() => {
    setIsSupported(!!getSpeechRecognition() || !!navigator.mediaDevices);
  }, []);

  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  const runFallbackRecording = useCallback(async (stream: MediaStream) => {
    setUsingFallback(true);
    chunksRef.current = [];

    const mimeType = MediaRecorder.isTypeSupported("audio/webm") ? "audio/webm" : "audio/mp4";
    const recorder = new MediaRecorder(stream, { mimeType });
    mediaRecorderRef.current = recorder;

    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) chunksRef.current.push(e.data);
    };

    recorder.onstop = async () => {
      setIsListening(false);
      const blob = new Blob(chunksRef.current, { type: mimeType });
      if (blob.size < 1000) return; // essentially silence

      try {
        const formData = new FormData();
        formData.append("audio", blob, `recording.${mimeType.includes("webm") ? "webm" : "mp4"}`);

        const res = await fetch("/api/transcribe-fallback", { method: "POST", body: formData });
        if (!res.ok) throw new Error(`Transcription failed (${res.status})`);
        const data = await res.json();
        setTranscript((prev) => (prev ? `${prev} ${data.text}` : data.text));
      } catch (err) {
        setError(err instanceof Error ? err.message : "Fallback transcription failed");
      }
    };

    recorder.start();
    setIsListening(true);
  }, []);

  const startListening = useCallback(
    async (existingStream?: MediaStream) => {
      setError(null);
      setInterimTranscript("");

      const RecognitionCtor = getSpeechRecognition();

      if (RecognitionCtor) {
        try {
          const recognition = new RecognitionCtor();
          recognition.continuous = false;
          recognition.interimResults = true;
          recognition.lang = "en-IN";

          recognition.onresult = (e: any) => {
            let interim = "";
            let final = "";
            for (let i = e.resultIndex; i < e.results.length; i++) {
              const chunk = e.results[i][0].transcript;
              if (e.results[i].isFinal) final += chunk;
              else interim += chunk;
            }
            if (final) setTranscript((prev) => (prev ? `${prev} ${final}` : final));
            setInterimTranscript(interim);
          };

          recognition.onerror = async (e: any) => {
            // network / no-speech / not-allowed -> drop to fallback
            if (e.error === "no-speech") {
              setError("No speech detected — try again.");
              setIsListening(false);
              return;
            }
            recognitionRef.current = null;
            const stream = existingStream ?? (await navigator.mediaDevices.getUserMedia({ audio: true }));
            runFallbackRecording(stream);
          };

          recognition.onend = () => {
            if (!usingFallback) setIsListening(false);
          };

          recognitionRef.current = recognition;
          recognition.start();
          setIsListening(true);
          setUsingFallback(false);
          return;
        } catch {
          // fall through to fallback below
        }
      }

      // No native support at all -> fallback straight away
      const stream = existingStream ?? (await navigator.mediaDevices.getUserMedia({ audio: true }));
      runFallbackRecording(stream);
    },
    [runFallbackRecording, usingFallback]
  );

  const stopListening = useCallback(() => {
    recognitionRef.current?.stop();
    if (mediaRecorderRef.current?.state === "recording") {
      mediaRecorderRef.current.stop();
    }
    setIsListening(false);
  }, []);

  return {
    isListening,
    transcript,
    interimTranscript,
    usingFallback,
    isSupported,
    error,
    startListening,
    stopListening,
  };
}