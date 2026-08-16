// components/voice/MicCheckCard.tsx
"use client";

import { useEffect, useRef, useState } from "react";
import { useTextToSpeech } from "@/lib/voice/useTextToSpeech";
import { useSpeechToText } from "@/lib/voice/useSpeechToText";
import { useAudioLevel } from "@/lib/voice/useAudioLevel";

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

  // 12 ledger bars driven by live mic level
  const bars = Array.from({ length: 12 }, (_, i) => {
    const distanceFromCenter = Math.abs(i - 5.5);
    const activation = Math.max(0, level - distanceFromCenter * 0.06);
    return 12 + activation * 88;
  });

  const isBusy = status === "prompting" || status === "listening";

  return (
    <div className="relative mx-auto w-full max-w-md">
      {/* punch-hole strip */}
      <div className="absolute -top-3 left-0 right-0 flex justify-center gap-3">
        {Array.from({ length: 8 }).map((_, i) => (
          <span
            key={i}
            className="h-2 w-2 rounded-full border"
            style={{ background: "var(--background)", borderColor: "var(--border)" }}
          />
        ))}
      </div>

      <div
        className="rounded-lg border border-dashed px-6 pb-6 pt-8"
        style={{ background: "var(--card)", borderColor: "var(--border)" }}
      >
        <div className="mb-4 flex items-center justify-between">
          <span className="label-mono">Voice Calibration Slip</span>
          <span
            className="rounded-full border px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide"
            style={{ color: "var(--seal)", borderColor: "var(--seal)" }}
          >
            {usingFallback ? "Fallback mode" : "Voice engine ready"}
          </span>
        </div>

        {/* seal-gold mic button */}
        <div className="flex flex-col items-center gap-3 py-4">
          <button
            type="button"
            onClick={handleTestMic}
            disabled={isBusy}
            className="seal-badge flex h-16 w-16 items-center justify-center transition-transform active:scale-95"
            style={{
              color: "var(--primary-foreground)",
              boxShadow: isBusy ? "0 0 0 6px color-mix(in srgb, var(--seal) 15%, transparent)" : "none",
            }}
            aria-label="Test my microphone"
          >
            <MicIcon />
          </button>

          <p className="text-center text-sm italic" style={{ color: "var(--foreground)" }}>
            "{CALIBRATION_PROMPT}"
          </p>
        </div>

        {/* ledger waveform */}
        <div className="my-4 flex h-16 items-end justify-center gap-1.5">
          {bars.map((h, i) => (
            <span
              key={i}
              className="w-2 rounded-sm transition-[height] duration-100"
              style={{
                height: status === "listening" ? `${h}%` : "12%",
                background: status === "listening" ? "var(--seal)" : "var(--muted-foreground)",
                opacity: isBusy ? 1 : 0.35,
              }}
            />
          ))}
        </div>

        {/* status line */}
        <div className="min-h-[24px] text-center text-sm">
          {status === "idle" && !sttSupported && (
            <span style={{ color: "var(--destructive)" }}>Voice input isn't supported in this browser.</span>
          )}
          {status === "prompting" && <span style={{ color: "var(--muted-foreground)" }}>Playing prompt…</span>}
          {status === "listening" && <span style={{ color: "var(--seal)" }}>Listening — say the phrase now…</span>}
          {status === "success" && (
            <span style={{ color: "var(--verified)" }}>Mic verified — heard: "{transcript}"</span>
          )}
          {status === "error" && (
            <span style={{ color: "var(--destructive)" }}>
              {sttError ?? "Something went wrong."}{" "}
              <button type="button" onClick={handleTestMic} className="underline">
                Try again
              </button>
            </span>
          )}
        </div>

        {isBusy && (
          <button
            type="button"
            onClick={handleStop}
            className="mx-auto mt-3 block text-xs underline"
            style={{ color: "var(--muted-foreground)" }}
          >
            Cancel
          </button>
        )}
      </div>

      {/* barcode footer */}
      <div className="mt-2 flex items-end justify-center gap-[2px]" aria-hidden="true">
        {Array.from({ length: 40 }).map((_, i) => (
          <span
            key={i}
            style={{
              width: (i * 7) % 3 === 0 ? "2px" : "1px",
              height: (i * 5) % 4 === 0 ? "14px" : "9px",
              background: "var(--foreground)",
              opacity: 0.7,
            }}
          />
        ))}
      </div>
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