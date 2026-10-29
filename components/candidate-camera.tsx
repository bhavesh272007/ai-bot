// TARGET PATH: components/candidate-camera.tsx
"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { Video, VideoOff, RefreshCw, AlertCircle, User } from "lucide-react";

interface CandidateCameraProps {
  autoStart?: boolean;
  width?: number;
  height?: number;
  fill?: boolean;
  candidateName?: string;
  className?: string;
}

/**
 * High-reliability Candidate Self-View Camera component.
 * Ensures srcObject is guaranteed to bind even when autoStart executes
 * before initial video element mount.
 */
export function CandidateCamera({
  autoStart = true,
  width,
  height,
  fill = true,
  candidateName = "You (Candidate)",
  className = "",
}: CandidateCameraProps) {
  const streamRef = useRef<MediaStream | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [enabled, setEnabled] = useState(false);
  const [error, setError] = useState("");
  const [isRequesting, setIsRequesting] = useState(false);

  // Bind video element whenever it mounts or when stream updates
  const setVideoRef = useCallback((el: HTMLVideoElement | null) => {
    videoRef.current = el;
    if (el && streamRef.current) {
      if (el.srcObject !== streamRef.current) {
        el.srcObject = streamRef.current;
      }
      el.play().catch(() => {});
    }
  }, []);

  async function start() {
    setError("");
    setIsRequesting(true);
    try {
      if (typeof navigator === "undefined" || !navigator.mediaDevices?.getUserMedia) {
        throw new Error("Camera API not supported in this browser.");
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: "user",
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
        audio: false, // audio is handled separately by the STT pipeline
      });

      streamRef.current = stream;

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play().catch(() => {});
      }

      setEnabled(true);
      setError("");
    } catch (err: any) {
      console.warn("Candidate camera access failed:", err);
      const isDenied = err?.name === "NotAllowedError" || err?.name === "PermissionDeniedError";
      setError(
        isDenied
          ? "Camera permission blocked. Click your browser URL lock icon to allow camera access."
          : "Webcam not detected or unavailable."
      );
      setEnabled(false);
    } finally {
      setIsRequesting(false);
    }
  }

  function stop() {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setEnabled(false);
  }

  function toggle() {
    if (enabled) stop();
    else start();
  }

  useEffect(() => {
    if (autoStart) {
      start();
    }
    return () => {
      streamRef.current?.getTracks().forEach((t) => t.stop());
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoStart]);

  // Keep srcObject in sync if enabled state toggles
  useEffect(() => {
    if (enabled && streamRef.current && videoRef.current) {
      videoRef.current.srcObject = streamRef.current;
      videoRef.current.play().catch(() => {});
    }
  }, [enabled]);

  const containerClasses = fill
    ? `relative w-full h-full overflow-hidden bg-slate-950 flex items-center justify-center select-none ${className}`
    : `relative rounded-xl border border-border bg-slate-950 overflow-hidden flex items-center justify-center select-none ${className}`;

  const containerStyle = !fill && width && height ? { width, height } : undefined;

  return (
    <div className={containerClasses} style={containerStyle}>
      {/* 1. Active Camera Video */}
      <video
        ref={setVideoRef}
        autoPlay
        playsInline
        muted
        className={`w-full h-full object-cover transition-opacity duration-300 ${
          enabled ? "opacity-100" : "opacity-0 pointer-events-none"
        }`}
        style={{ transform: "scaleX(-1)" }} // mirror self-view
      />

      {/* 2. Disabled / Permission Blocked State */}
      {!enabled && (
        <div className="absolute inset-0 flex flex-col items-center justify-center p-4 text-center bg-slate-950 text-slate-300">
          <div className="w-16 h-16 rounded-full bg-slate-900 border border-slate-800 flex items-center justify-center text-slate-400 mb-3 shadow-inner">
            {error ? (
              <AlertCircle className="w-8 h-8 text-rose-400" />
            ) : (
              <User className="w-8 h-8 text-slate-400" />
            )}
          </div>

          <p className="text-xs font-semibold text-white mb-1">
            {error ? "Webcam Access Required" : "Candidate Camera is Off"}
          </p>
          <p className="text-[11px] text-slate-400 max-w-xs mb-3 leading-relaxed">
            {error || "Turn on your webcam to practice with realistic two-way video."}
          </p>

          <button
            type="button"
            onClick={start}
            disabled={isRequesting}
            className="px-3.5 py-1.5 rounded-full bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold flex items-center gap-1.5 shadow-lg shadow-emerald-600/25 transition-all disabled:opacity-50"
          >
            {isRequesting ? (
              <RefreshCw className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Video className="w-3.5 h-3.5" />
            )}
            <span>{isRequesting ? "Connecting..." : error ? "Retry Camera" : "Enable Camera"}</span>
          </button>
        </div>
      )}

      {/* 3. Top-left Zoom Live Indicator */}
      {enabled && (
        <div className="absolute top-3 left-3 flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-slate-950/80 backdrop-blur-md border border-white/10 text-[10px] font-mono text-white shadow-lg pointer-events-none z-10">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-500 opacity-75" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-rose-500" />
          </span>
          <span>LIVE</span>
        </div>
      )}

      {/* 4. Bottom-left Candidate Name Tag */}
      <div className="absolute bottom-3 left-3 flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-slate-950/80 backdrop-blur-md border border-white/10 text-xs font-medium text-white shadow-lg pointer-events-none z-10">
        <span>{candidateName}</span>
      </div>

      {/* 5. Bottom-right Quick Toggle Button */}
      <button
        type="button"
        onClick={toggle}
        title={enabled ? "Turn camera off" : "Turn camera on"}
        className={`absolute bottom-3 right-3 h-8 w-8 rounded-full flex items-center justify-center transition-all z-20 border shadow-lg ${
          enabled
            ? "bg-slate-900/90 hover:bg-slate-800 text-slate-200 border-white/15"
            : "bg-rose-500/20 hover:bg-rose-500/30 text-rose-400 border-rose-500/30"
        }`}
      >
        {enabled ? <Video className="h-4 w-4" /> : <VideoOff className="h-4 w-4" />}
      </button>
    </div>
  );
}
