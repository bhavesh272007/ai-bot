// TARGET PATH: components/candidate-camera.tsx
"use client";

import { useEffect, useRef, useState } from "react";
import { Video, VideoOff } from "lucide-react";

interface CandidateCameraProps {
  // Start the camera immediately on mount (still requires the browser's
  // native permission prompt — this just skips the extra manual click,
  // since consent is already gathered via the intro-screen checkbox).
  autoStart?: boolean;
  width?: number;
  height?: number;
}

// Pure self-view, same privacy promise as the resume upload: the camera
// feed is only ever rendered to this <video> element in the candidate's own
// browser. Nothing is recorded, saved, uploaded, or transmitted anywhere —
// there is deliberately no MediaRecorder here at all.
export function CandidateCamera({ autoStart = false, width = 168, height = 126 }: CandidateCameraProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [enabled, setEnabled] = useState(false);
  const [error, setError] = useState("");

  async function start() {
    setError("");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user" },
        audio: false, // no audio capture here — voice answers already go through the separate STT pipeline
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
      setEnabled(true);
    } catch {
      setError("Camera access denied or unavailable.");
      setEnabled(false);
    }
  }

  function stop() {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
    setEnabled(false);
  }

  function toggle() {
    if (enabled) stop();
    else start();
  }

  useEffect(() => {
    if (autoStart) start();
    return () => {
      streamRef.current?.getTracks().forEach((t) => t.stop());
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="flex flex-col items-center gap-1.5">
      <div
        className="relative rounded-md border border-border bg-muted overflow-hidden flex items-center justify-center shadow-sm"
        style={{ width, height }}
      >
        {enabled ? (
          <>
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className="w-full h-full object-cover"
              style={{ transform: "scaleX(-1)" }} // mirrored, like a normal self-view
            />
            {/* Live indicator — this IS live video, just never recorded */}
            <span className="absolute top-1.5 left-1.5 flex items-center gap-1 rounded-full bg-background/80 px-1.5 py-0.5">
              <span className="relative flex h-1.5 w-1.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-destructive opacity-75" />
                <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-destructive" />
              </span>
              <span className="text-[9px] font-mono text-foreground">LIVE</span>
            </span>
          </>
        ) : (
          <VideoOff className="h-5 w-5 text-muted-foreground/50" />
        )}
        <button
          type="button"
          onClick={toggle}
          title={enabled ? "Turn camera off" : "Turn camera on"}
          className="absolute bottom-1 right-1 h-6 w-6 rounded-full bg-background/90 border border-border flex items-center justify-center hover:bg-muted transition-colors"
        >
          {enabled ? (
            <Video className="h-3 w-3 text-foreground" />
          ) : (
            <VideoOff className="h-3 w-3 text-muted-foreground" />
          )}
        </button>
      </div>
      {error && (
        <p className="text-[10px] text-destructive text-center leading-tight" style={{ maxWidth: width }}>
          {error}
        </p>
      )}
    </div>
  );
}