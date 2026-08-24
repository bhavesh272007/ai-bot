// TARGET PATH: components/voice/MicCheckCard.tsx
"use client";

import { useEffect, useRef, useState } from "react";
import { useTextToSpeech } from "@/lib/voice/useTextToSpeech";
import { useSpeechToText } from "@/lib/voice/useSpeechToText";
import { useAudioLevel } from "@/lib/voice/useAudioLevel";
import styles from "./MicCheckCard.module.css";

const CALIBRATION_PROMPT = "I'm ready for my interview — testing one, two, three.";

type Status = "idle" | "prompting" | "listening" | "success" | "error";

export function MicCheckCard({ onVerified }: { onVerified?: () => void }) {
  const { speak, isSupported: ttsSupported } = useTextToSpeech();
  const {
    startListening,
    stopListening,
    transcript,
    isSupported: sttSupported,
    usingFallback,
    error: sttError,
  } = useSpeechToText();
  const { level, start: startMeter, stop: stopMeter } = useAudioLevel();

  const [status, setStatus] = useState<Status>("idle");
  const streamRef = useRef<MediaStream | null>(null);

  useEffect(() => {
    if (transcript.trim().length > 3 && status === "listening") {
      setStatus("success");
      stopMeter();
      onVerified?.();
    }
  }, [transcript, status, stopMeter, onVerified]);

  useEffect(() => {
    if (sttError) setStatus("error");
  }, [sttError]);

  const beginListening = async () => {
    setStatus("listening");
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    streamRef.current = stream;
    startMeter();
    startListening(stream);
  };

  const handleTestMic = () => {
    if (ttsSupported) {
      // Only start recognition once the prompt has finished playing —
      // starting both at once means the mic hears silence while the
      // prompt is being read, and recognition times out with "no-speech"
      // before the person gets a chance to actually talk.
      setStatus("prompting");
      speak(CALIBRATION_PROMPT, { onEnd: beginListening });
    } else {
      beginListening();
    }
  };

  const handleStop = () => {
    stopListening();
    stopMeter();
    streamRef.current?.getTracks().forEach((t) => t.stop());
    if (status === "listening" || status === "prompting") setStatus("idle");
  };

  // 12 bars driven by live mic level
  const bars = Array.from({ length: 12 }, (_, i) => {
    const distanceFromCenter = Math.abs(i - 5.5);
    const activation = Math.max(0, level - distanceFromCenter * 0.06);
    return 12 + activation * 88;
  });

  const isBusy = status === "prompting" || status === "listening";

  return (
    <div className={styles.panel}>
      <div className={styles.headRow}>
        <span className={styles.headLabel}>Voice calibration</span>
        <span className={`${styles.statusPill} ${usingFallback ? styles.statusPillFallback : styles.statusPillReady}`}>
          {usingFallback ? "Fallback mode" : "Voice engine ready"}
        </span>
      </div>

      <div className={styles.micArea}>
        <button
          type="button"
          onClick={handleTestMic}
          disabled={isBusy}
          className={`${styles.micBtn} ${isBusy ? styles.micBtnBusy : ""}`}
          aria-label="Test my microphone"
        >
          <MicIcon />
        </button>

        <p className={styles.prompt}>&ldquo;{CALIBRATION_PROMPT}&rdquo;</p>
      </div>

      <div className={styles.waveform}>
        {bars.map((h, i) => (
          <span
            key={i}
            className={styles.bar}
            style={{
              height: status === "listening" ? `${h}%` : "14%",
              background: status === "listening" ? "#1f8f74" : "#d8d8d8",
              opacity: isBusy ? 1 : 0.6,
            }}
          />
        ))}
      </div>

      <div className={styles.statusLine}>
        {status === "idle" && !sttSupported && (
          <span className={styles.statusIdleWarn}>Voice input isn&apos;t supported in this browser.</span>
        )}
        {status === "prompting" && <span className={styles.statusMuted}>Playing prompt…</span>}
        {status === "listening" && <span className={styles.statusListening}>Listening — say the phrase now…</span>}
        {status === "success" && (
          <span className={styles.statusSuccess}>Mic verified — heard: &ldquo;{transcript}&rdquo;</span>
        )}
        {status === "error" && (
          <span className={styles.statusError}>
            {sttError ?? "Something went wrong."}{" "}
            <button type="button" onClick={handleTestMic} className={styles.retryLink}>
              Try again
            </button>
          </span>
        )}
      </div>

      {isBusy && (
        <button type="button" onClick={handleStop} className={styles.cancelBtn}>
          Cancel
        </button>
      )}
    </div>
  );
}

function MicIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="9" y="2" width="6" height="12" rx="3" />
      <path d="M5 10a7 7 0 0 0 14 0" />
      <line x1="12" y1="19" x2="12" y2="22" />
    </svg>
  );
}