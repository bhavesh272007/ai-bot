"use client";

import React, { useRef, useEffect } from "react";
import {
  Mic,
  MicOff,
  Video as VideoIcon,
  VideoOff,
  PhoneOff,
  Volume2,
  VolumeX,
  ShieldCheck,
  Wifi,
  Sparkles,
} from "lucide-react";
import { LipSyncCanvas } from "@/components/lip-sync-canvas";
import type { LipSyncFrame } from "@/lib/voice/useLipSync";

export interface VideoAvatarProps {
  state: "idle" | "listening" | "speaking";
  interviewerName?: string;
  roleLabel?: string;
  category?: string;
  idleVideoUrl?: string | string[];
  speakingVideoUrl?: string | string[];
  fill?: boolean;
  caption?: string;
  showControls?: boolean;
  isMuted?: boolean;
  onToggleMute?: () => void;
  cameraEnabled?: boolean;
  onToggleCamera?: () => void;
  onEndCall?: () => void;
  className?: string;
  /** Lip-sync frame produced by useLipSync(). When provided, renders the
   *  phoneme-driven mouth canvas overlay over the speaking video. */
  lipSyncFrame?: LipSyncFrame;
  /** Position of the mouth within the video frame as % from top (default 72).
   *  Tune this to match your video clip's face position. */
  mouthTopPct?: number;
  /** Width of the mouth as % of video width (default 18). */
  mouthWidthPct?: number;
}

export function VideoAvatar({
  state,
  interviewerName = "Sarah Miller",
  roleLabel = "Senior Technical Interviewer",
  category,
  idleVideoUrl = ["/interviewer-idle.mp4", "/interviewer-idle-2.mp4", "/interviewer-idle-3.mp4"],
  speakingVideoUrl = ["/interviewer-talk.mp4", "/interviewer-talk-2.mp4"],
  fill = false,
  caption,
  showControls = false,
  isMuted = false,
  onToggleMute,
  cameraEnabled = true,
  onToggleCamera,
  onEndCall,
  className = "",
  lipSyncFrame,
  mouthTopPct = 72,
  mouthWidthPct = 18,
}: VideoAvatarProps) {
  const idleRef = useRef<HTMLVideoElement>(null);
  const speakingRef = useRef<HTMLVideoElement>(null);

  // Normalize video URL inputs into arrays
  const idleList = React.useMemo(
    () => (Array.isArray(idleVideoUrl) ? idleVideoUrl : [idleVideoUrl]),
    [idleVideoUrl]
  );
  const speakingList = React.useMemo(
    () => (Array.isArray(speakingVideoUrl) ? speakingVideoUrl : [speakingVideoUrl]),
    [speakingVideoUrl]
  );

  const [idleIndex, setIdleIndex] = React.useState(0);
  const [speakingIndex, setSpeakingIndex] = React.useState(0);
  const [availableIdleCount, setAvailableIdleCount] = React.useState(idleList.length);
  const [availableSpeakingCount, setAvailableSpeakingCount] = React.useState(speakingList.length);

  const isSpeaking = state === "speaking";
  const isListening = state === "listening";

  // Cycle idle posture whenever interviewer finishes speaking and begins listening to candidate
  useEffect(() => {
    if (state === "listening" || state === "idle") {
      if (availableIdleCount > 1) {
        setIdleIndex((prev) => (prev + 1) % availableIdleCount);
      }
    } else if (state === "speaking") {
      if (availableSpeakingCount > 1) {
        setSpeakingIndex((prev) => (prev + 1) % availableSpeakingCount);
      }
    }
  }, [state, availableIdleCount, availableSpeakingCount]);

  // Autoplay / maintain playback rate on mount and on src change
  useEffect(() => {
    const playCurrentVideos = async () => {
      try {
        if (idleRef.current) {
          idleRef.current.playbackRate = 1.0;
          await idleRef.current.play();
        }
      } catch {}

      try {
        if (speakingRef.current) {
          speakingRef.current.playbackRate = 1.0;
          await speakingRef.current.play();
        }
      } catch {}
    };

    playCurrentVideos();
  }, [idleIndex, speakingIndex]);

  // Safe fallback if optional clips (-2, -3) don't exist in public/ yet
  const handleIdleError = () => {
    // If a secondary clip (index > 0) failed to load, revert to base clip and lock to 1
    if (idleIndex > 0) {
      setIdleIndex(0);
      setAvailableIdleCount(1);
    }
  };

  const handleSpeakingError = () => {
    if (speakingIndex > 0) {
      setSpeakingIndex(0);
      setAvailableSpeakingCount(1);
    }
  };

  // Zoom-style Active Speaker Border
  const speakerRingClass = isSpeaking
    ? "ring-2 ring-emerald-500 shadow-[0_0_35px_rgba(16,185,129,0.3)] transition-all duration-300"
    : isListening
    ? "ring-2 ring-indigo-500/80 shadow-[0_0_35px_rgba(99,102,241,0.25)] transition-all duration-300"
    : "ring-1 ring-slate-800/80 shadow-2xl transition-all duration-300";

  const containerClasses = fill
    ? `absolute inset-0 w-full h-full overflow-hidden bg-slate-950 select-none ${speakerRingClass} ${className}`
    : `relative w-full aspect-video rounded-3xl overflow-hidden bg-slate-950 border border-slate-800/80 select-none ${speakerRingClass} ${className}`;

  return (
    <div className={containerClasses}>
      {/* 1. Base Layer: Idle / Listening Video (Cycles through idle variations) */}
      <video
        ref={idleRef}
        src={idleList[idleIndex] || idleList[0]}
        loop={availableIdleCount <= 1}
        onEnded={() => {
          if (availableIdleCount > 1) {
            setIdleIndex((prev) => (prev + 1) % availableIdleCount);
          }
        }}
        onError={handleIdleError}
        muted
        playsInline
        preload="auto"
        className="absolute inset-0 w-full h-full object-cover"
      />

      {/* 2. Overlay Layer: Speaking Video with Zero-flicker Crossfade */}
      <video
        ref={speakingRef}
        src={speakingList[speakingIndex] || speakingList[0]}
        loop={availableSpeakingCount <= 1}
        onEnded={() => {
          if (availableSpeakingCount > 1) {
            setSpeakingIndex((prev) => (prev + 1) % availableSpeakingCount);
          }
        }}
        onError={handleSpeakingError}
        muted
        playsInline
        preload="auto"
        className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-200 ease-in-out ${
          isSpeaking ? "opacity-100" : "opacity-0 pointer-events-none"
        }`}
      />

      {/* 3. Lip Sync Canvas Overlay — phoneme-driven mouth animation */}
      {lipSyncFrame && (
        <LipSyncCanvas
          frame={lipSyncFrame}
          isSpeaking={isSpeaking}
          mouthTopPct={mouthTopPct}
          mouthWidthPct={mouthWidthPct}
        />
      )}

      {/* Subtle cinematic gradient vignette for UI legibility */}
      <div className="absolute inset-0 bg-gradient-to-t from-slate-950/85 via-transparent to-slate-950/60 pointer-events-none z-1" />

      {/* Top Zoom Meeting Header */}
      <div className="absolute top-3.5 left-3.5 right-3.5 flex items-center justify-between z-10 pointer-events-none">
        {/* Left: Host Participant Tag */}
        <div className="flex items-center gap-2.5 px-3 py-1.5 rounded-full bg-slate-950/80 backdrop-blur-xl border border-white/10 shadow-lg">
          {/* Active Audio Waveform / Pulsing Dot */}
          {isSpeaking ? (
            <div className="flex items-end gap-0.5 h-3.5 px-0.5">
              <span className="w-1 bg-emerald-400 rounded-full animate-[bounce_0.6s_ease-in-out_infinite]" style={{ height: "60%" }} />
              <span className="w-1 bg-emerald-400 rounded-full animate-[bounce_0.4s_ease-in-out_infinite]" style={{ height: "100%" }} />
              <span className="w-1 bg-emerald-400 rounded-full animate-[bounce_0.7s_ease-in-out_infinite]" style={{ height: "75%" }} />
            </div>
          ) : isListening ? (
            <span className="relative flex h-2.5 w-2.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-indigo-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-indigo-500" />
            </span>
          ) : (
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
          )}

          <div className="flex items-center gap-1.5 text-xs font-semibold text-white tracking-wide">
            <span>{interviewerName}</span>
            <span className="text-[10px] font-mono text-slate-400 font-normal">
              (Host)
            </span>
            {isListening && (
              <span className="text-[10px] uppercase font-bold text-indigo-300 tracking-wider bg-indigo-950/70 px-2 py-0.5 rounded-md border border-indigo-800/60">
                Listening to you
              </span>
            )}
          </div>
        </div>

        {/* Right: Zoom HD & Security Badges */}
        <div className="flex items-center gap-2">
          <div className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-slate-950/80 backdrop-blur-xl border border-white/10 text-[11px] font-mono text-emerald-400">
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>Encrypted HD</span>
          </div>

          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-slate-950/80 backdrop-blur-xl border border-white/10 text-[11px] font-mono text-slate-200">
            <span className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-pulse" />
            <span>REC</span>
            <span className="text-slate-500">•</span>
            <Wifi className="w-3 h-3 text-emerald-400" />
          </div>
        </div>
      </div>

      {/* Live Zoom Closed Captions Overlay (Subtitles) */}
      {caption && (
        <div className="absolute bottom-16 sm:bottom-14 left-4 right-4 z-10 flex justify-center pointer-events-none">
          <div className="max-w-xl px-4 py-2 rounded-2xl bg-black/85 backdrop-blur-xl border border-white/15 text-slate-100 text-xs sm:text-sm font-medium leading-relaxed text-center shadow-2xl">
            <span className="text-emerald-400 font-bold mr-1.5 font-mono text-xs">
              {interviewerName}:
            </span>
            <span>&ldquo;{caption}&rdquo;</span>
          </div>
        </div>
      )}

      {/* Bottom Floating Zoom Controls Bar */}
      {showControls ? (
        <div className="absolute bottom-3.5 left-1/2 -translate-x-1/2 flex items-center gap-2.5 px-4 py-2 rounded-2xl bg-slate-950/85 backdrop-blur-2xl border border-white/10 shadow-2xl z-20">
          {onToggleMute && (
            <button
              type="button"
              onClick={onToggleMute}
              title={isMuted ? "Unmute Mic" : "Mute Mic"}
              className={`p-2 rounded-xl transition-colors ${
                isMuted
                  ? "bg-rose-500/20 text-rose-400 hover:bg-rose-500/30 border border-rose-500/30"
                  : "bg-slate-800 text-slate-200 hover:bg-slate-700 border border-slate-700"
              }`}
            >
              {isMuted ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
            </button>
          )}

          {onToggleCamera && (
            <button
              type="button"
              onClick={onToggleCamera}
              title={cameraEnabled ? "Turn off camera" : "Turn on camera"}
              className={`p-2 rounded-xl transition-colors ${
                !cameraEnabled
                  ? "bg-rose-500/20 text-rose-400 hover:bg-rose-500/30 border border-rose-500/30"
                  : "bg-slate-800 text-slate-200 hover:bg-slate-700 border border-slate-700"
              }`}
            >
              {cameraEnabled ? <VideoIcon className="w-4 h-4" /> : <VideoOff className="w-4 h-4" />}
            </button>
          )}

          <div className="h-4 w-px bg-slate-800" />

          <div className="flex items-center gap-1.5 px-2 py-0.5 text-[11px] font-medium text-slate-300 select-none">
            <span className="w-2 h-2 rounded-full bg-emerald-400" />
            <span>{isSpeaking ? "Speaking" : isListening ? "Listening" : "Connected"}</span>
          </div>

          {onEndCall && (
            <>
              <div className="h-4 w-px bg-slate-800" />
              <button
                type="button"
                onClick={onEndCall}
                className="px-3 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white transition-all flex items-center gap-1.5 text-xs font-semibold shadow-lg shadow-rose-600/30"
              >
                <PhoneOff className="w-3.5 h-3.5" />
                <span>Leave</span>
              </button>
            </>
          )}
        </div>
      ) : (
        /* Minimal Bottom Status Badge when full controls aren't mounted */
        <div className="absolute bottom-3 left-3 z-10 flex items-center gap-2 px-3 py-1.5 rounded-full bg-slate-950/80 backdrop-blur-xl border border-white/10 text-xs text-slate-300 shadow-lg pointer-events-none">
          <span
            className={`w-2 h-2 rounded-full ${
              isSpeaking
                ? "bg-emerald-400 animate-pulse"
                : isListening
                ? "bg-indigo-400 animate-pulse"
                : "bg-slate-400"
            }`}
          />
          <span className="text-[11px] font-medium">
            {isSpeaking
              ? "Speaking with candidate"
              : isListening
              ? "Listening to candidate..."
              : "Room Ready"}
          </span>
        </div>
      )}
    </div>
  );
}
