// TARGET PATH: lib/voice/useVoiceCapture.ts
"use client";

import { useCallback, useEffect, useRef, useState } from "react";

// Interview-grade continuous speech capture, lifted out of
// app/interview/[id]/page.tsx so the Q&A round and the coding round's
// think-aloud narration share one implementation instead of two copies.
//
// NOT the same thing as lib/voice/useSpeechToText.ts — that one is a one-shot,
// non-continuous helper for the /test-voice mic check. This one is continuous,
// appends to text the caller already owns, rescues itself onto the Whisper
// fallback mid-answer, and can keep the mic alive on its own.

type SpeechRecognitionResultLike = {
  isFinal: boolean;
  0: { transcript: string };
};
type SpeechRecognitionEventLike = {
  resultIndex: number;
  results: SpeechRecognitionResultLike[] & { length: number };
};

interface UseVoiceCaptureOptions {
  // Read the caller's current text when a capture session starts (and when a
  // fallback transcription lands), so new speech appends to whatever is
  // already there instead of clobbering it.
  getBaseText: () => string;
  // Replace the caller's text. Called continuously while native recognition is
  // running (committed words + interim), and once after a fallback
  // transcription resolves.
  setText: (text: string) => void;

  // ---- Auto-listen "keeper" ----
  // When true the mic restarts itself as needed, so a browser timing out on
  // silence doesn't leave it silently dead. Meeting mode only.
  autoListen?: boolean;
  // Momentary reasons not to be listening right now — the interviewer is
  // speaking, a typed-answer panel is open, a request is in flight. The keeper
  // waits rather than fighting these.
  autoListenBlocked?: boolean;
  // Caps restarts for the current "unit of work" so a genuinely denied mic
  // permission can't turn into an endless prompt loop. Reset via
  // resetAutoRestarts() whenever that unit changes (a new question, a code run).
  // Any actual speech also resets it — proof the mic really is working.
  maxAutoRestarts?: number;
  // The Whisper fallback uploads audio, so auto-restarting it on silence would
  // burn API calls for nothing. Set true where the fallback should be
  // push-to-talk only (the coding round, where long silences are normal).
  autoListenNativeOnly?: boolean;
}

export interface VoiceCapture {
  isListening: boolean;
  // True while the CURRENT session is using record+Whisper instead of live
  // native recognition (no interim transcript in this mode — text only fills
  // in once recording stops and Whisper responds).
  usingFallback: boolean;
  transcribing: boolean;
  // Native SpeechRecognition present in this browser.
  micSupported: boolean;
  // Can capture voice at ALL, natively or via record+Whisper. Gates whether a
  // mic button is worth showing.
  voiceInputSupported: boolean;
  start: () => void;
  stop: () => void;
  toggle: () => void;
  resetAutoRestarts: () => void;
}

export function useVoiceCapture({
  getBaseText,
  setText,
  autoListen = false,
  autoListenBlocked = false,
  maxAutoRestarts = 8,
  autoListenNativeOnly = false,
}: UseVoiceCaptureOptions): VoiceCapture {
  const [micSupported, setMicSupported] = useState(false);
  const [voiceInputSupported, setVoiceInputSupported] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [usingFallback, setUsingFallback] = useState(false);
  const [transcribing, setTranscribing] = useState(false);

  const recognitionRef = useRef<any>(null);
  const baseTextRef = useRef(""); // committed text before the current session
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const activeStreamRef = useRef<MediaStream | null>(null);
  const restartAttemptsRef = useRef(0);
  // Read inside long-lived event handlers, where a captured state value would
  // be stale by the time it matters.
  const usingFallbackRef = useRef(false);

  // Callbacks change identity every render; keep them in a ref so the capture
  // handlers never close over a stale version.
  const callbacksRef = useRef({ getBaseText, setText });
  callbacksRef.current = { getBaseText, setText };

  // Feature-detect once on mount (must run client-side only).
  useEffect(() => {
    const SpeechRecognitionCtor =
      typeof window !== "undefined" &&
      ((window as any).SpeechRecognition || (window as any).webkitSpeechRecognition);
    setMicSupported(!!SpeechRecognitionCtor);
    // Voice input is usable either through native recognition, or through
    // plain mic capture + our Whisper fallback endpoint — so this is true for
    // effectively every modern browser, including Firefox.
    setVoiceInputSupported(
      !!SpeechRecognitionCtor ||
        (typeof navigator !== "undefined" && !!navigator.mediaDevices?.getUserMedia)
    );
  }, []);

  // Record raw audio and send it to our Groq Whisper fallback endpoint. Used
  // for browsers with no native SpeechRecognition (e.g. Firefox), and as a
  // mid-answer rescue if native recognition throws an error.
  const startFallbackRecording = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      activeStreamRef.current = stream;
      audioChunksRef.current = [];

      const mimeType = MediaRecorder.isTypeSupported("audio/webm") ? "audio/webm" : "audio/mp4";
      const recorder = new MediaRecorder(stream, { mimeType });
      mediaRecorderRef.current = recorder;

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) audioChunksRef.current.push(e.data);
      };

      recorder.onstop = async () => {
        setIsListening(false);
        stream.getTracks().forEach((t) => t.stop());
        activeStreamRef.current = null;

        const blob = new Blob(audioChunksRef.current, { type: mimeType });
        if (blob.size < 1000) return; // essentially silence — nothing worth sending

        setTranscribing(true);
        try {
          const formData = new FormData();
          formData.append("audio", blob, `recording.${mimeType.includes("webm") ? "webm" : "mp4"}`);

          const res = await fetch("/api/transcribe-fallback", { method: "POST", body: formData });
          if (!res.ok) throw new Error("Transcription failed");

          const data = await res.json();
          const text = (data.text || "").trim();
          if (text) {
            const prev = callbacksRef.current.getBaseText();
            callbacksRef.current.setText(prev.trim() ? `${prev.trim()} ${text}` : text);
            restartAttemptsRef.current = 0; // real speech — refresh the budget
          }
        } catch {
          // Fail quietly — whatever the candidate already typed/said stays in
          // the box, they can just keep typing or try the mic again.
        } finally {
          setTranscribing(false);
        }
      };

      recorder.start();
      usingFallbackRef.current = true;
      setUsingFallback(true);
      setIsListening(true);
    } catch {
      // Mic permission denied or no device available — nothing more to do.
      setIsListening(false);
    }
  }, []);

  const startNativeRecognition = useCallback(() => {
    const SpeechRecognitionCtor =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    const recognition = new SpeechRecognitionCtor();
    recognition.lang = "en-US";
    recognition.continuous = true;
    recognition.interimResults = true;

    recognition.onresult = (event: SpeechRecognitionEventLike) => {
      let interim = "";
      let final = "";
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const transcript = event.results[i][0].transcript;
        if (event.results[i].isFinal) {
          final += transcript + " ";
        } else {
          interim += transcript;
        }
      }
      if (final) {
        baseTextRef.current = baseTextRef.current + final;
      }
      callbacksRef.current.setText((baseTextRef.current + interim).trim());
      // Proof the mic is actually working — a long answer with several natural
      // pauses shouldn't ever hit the auto-listen restart cap.
      if (final || interim) restartAttemptsRef.current = 0;
    };

    recognition.onerror = (e: any) => {
      if (e.error === "no-speech" || e.error === "aborted") {
        setIsListening(false);
        return;
      }
      // Something more disruptive (network drop, permission hiccup) — rescue
      // the rest of THIS answer with record+Whisper instead of just dropping
      // the candidate back to typing mid-sentence.
      recognitionRef.current = null;
      setIsListening(false);
      startFallbackRecording();
    };

    recognition.onend = () => {
      if (!usingFallbackRef.current) setIsListening(false);
    };

    recognitionRef.current = recognition;
    usingFallbackRef.current = false;
    setUsingFallback(false);
    try {
      recognition.start();
      setIsListening(true);
    } catch {
      // Most commonly thrown when the browser hasn't fully released the mic
      // from the PREVIOUS recognition session yet (only one can be active at a
      // time). Leaving isListening false here (rather than throwing uncaught)
      // means the keeper effect just quietly retries on its next debounce tick
      // instead of the mic dying with no signal.
      recognitionRef.current = null;
      setIsListening(false);
    }
  }, [startFallbackRecording]);

  // Prefers native SpeechRecognition (live, free, no round-trip); falls back to
  // record+Whisper when native isn't available in this browser.
  const start = useCallback(() => {
    if (!voiceInputSupported) return;
    // Keep whatever's already typed/transcribed and append to it.
    const base = callbacksRef.current.getBaseText();
    baseTextRef.current = base ? base.trim() + " " : "";

    if (micSupported) {
      startNativeRecognition();
    } else {
      startFallbackRecording();
    }
  }, [voiceInputSupported, micSupported, startNativeRecognition, startFallbackRecording]);

  // Stops whichever capture path is currently active. Deliberately says nothing
  // about text-to-speech — callers that also want the interviewer to stop
  // talking cancel TTS themselves.
  const stop = useCallback(() => {
    if (usingFallbackRef.current) {
      mediaRecorderRef.current?.stop();
    } else {
      recognitionRef.current?.stop();
    }
  }, []);

  const toggle = useCallback(() => {
    if (!voiceInputSupported) return;
    if (isListening) {
      stop();
      return;
    }
    start();
  }, [voiceInputSupported, isListening, stop, start]);

  const resetAutoRestarts = useCallback(() => {
    restartAttemptsRef.current = 0;
  }, []);

  // The auto-listen keeper. Not a one-shot: it re-evaluates every time
  // isListening or a blocking condition changes, so if native recognition times
  // out from silence (browsers do this even with continuous:true, often within
  // a few seconds) it just restarts automatically. A short debounce avoids
  // hammering getUserMedia if it's restarting rapidly, and the attempt cap
  // stops it re-prompting forever if permission was actually denied.
  useEffect(() => {
    if (!autoListen || !voiceInputSupported) return;
    if (autoListenBlocked || isListening || transcribing) return;
    if (autoListenNativeOnly && !micSupported) return;
    if (restartAttemptsRef.current >= maxAutoRestarts) return;

    const t = setTimeout(() => {
      restartAttemptsRef.current += 1;
      start();
    }, 700);

    return () => clearTimeout(t);
  }, [
    autoListen,
    autoListenBlocked,
    autoListenNativeOnly,
    voiceInputSupported,
    micSupported,
    isListening,
    transcribing,
    maxAutoRestarts,
    start,
  ]);

  // Stop any recognition/recording on unmount
  useEffect(() => {
    return () => {
      recognitionRef.current?.stop();
      if (mediaRecorderRef.current?.state === "recording") {
        mediaRecorderRef.current.stop();
      }
      activeStreamRef.current?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  return {
    isListening,
    usingFallback,
    transcribing,
    micSupported,
    voiceInputSupported,
    start,
    stop,
    toggle,
    resetAutoRestarts,
  };
}
