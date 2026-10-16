"use client";

import React, { useEffect, useRef, useState, useCallback } from "react";
import { createClient, AnamEvent } from "@anam-ai/js-sdk";
import { Loader2, Mic, MicOff, Volume2, AlertCircle, RefreshCw, Sparkles, PhoneOff } from "lucide-react";
import { Button } from "@/components/ui/button";

interface AnamAvatarProps {
  sessionToken: string;
  interviewerName?: string;
  onTalkStart?: () => void;
  onTalkEnd?: () => void;
  onError?: (err: Error) => void;
}

// Global reference to ensure only ONE active Anam WebRTC session exists at any time
let activeGlobalAnamClient: any = null;

export function AnamAvatar({
  sessionToken,
  interviewerName = "Sarah Miller",
  onTalkStart,
  onTalkEnd,
  onError,
}: AnamAvatarProps) {
  const [isConnected, setIsConnected] = useState(false);
  const [isTalking, setIsTalking] = useState(false);
  const [isUserSpeaking, setIsUserSpeaking] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);
  const [canRetry, setCanRetry] = useState(true);

  const clientRef = useRef<any>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const isCleaningUpRef = useRef(false);
  const isInitializingRef = useRef(false); // Guard against concurrent init calls

  const cleanupActiveSession = useCallback(async () => {
    if (isCleaningUpRef.current) return; // Prevent re-entrant cleanup
    isCleaningUpRef.current = true;

    if (clientRef.current?.stopStreaming) {
      try {
        await clientRef.current.stopStreaming();
      } catch (e) {
        console.warn("Cleanup error on local client:", e);
      }
      clientRef.current = null;
    }
    if (activeGlobalAnamClient?.stopStreaming) {
      try {
        await activeGlobalAnamClient.stopStreaming();
      } catch (e) {
        console.warn("Cleanup error on global client:", e);
      }
      activeGlobalAnamClient = null;
    }

    // Give Anam's edge gateway time to register session closure
    await new Promise((resolve) => setTimeout(resolve, 600));

    setIsConnected(false);
    isCleaningUpRef.current = false;
  }, []);

  const initSession = useCallback(async () => {
    if (!sessionToken) return;

    // Guard: don't start a new init if one is already in progress
    if (isInitializingRef.current) return;
    isInitializingRef.current = true;

    setIsConnecting(true);
    setErrorMsg(null);

    try {
      // 1. Terminate any lingering previous stream first to prevent concurrency limit errors
      await cleanupActiveSession();

      // Brief delay to allow Anam's edge gateway to register session closure
      // cleanupActiveSession already has a 600ms delay, but adding a small buffer for safety
      await new Promise((resolve) => setTimeout(resolve, 100));

      // 2. Create new Anam client
      const client = createClient(sessionToken);
      clientRef.current = client;
      activeGlobalAnamClient = client;

      // 3. Register Event Listeners
      if (typeof client.addListener === "function") {
        client.addListener(AnamEvent.CONNECTION_ESTABLISHED, () => {
          setIsConnected(true);
          setIsConnecting(false);
        });

        client.addListener(AnamEvent.VIDEO_PLAY_STARTED, () => {
          setIsConnected(true);
          setIsConnecting(false);
        });

        client.addListener(AnamEvent.USER_SPEECH_STARTED, () => {
          setIsUserSpeaking(true);
        });

        client.addListener(AnamEvent.USER_SPEECH_ENDED, () => {
          setIsUserSpeaking(false);
        });

        client.addListener(AnamEvent.CONNECTION_CLOSED, () => {
          setIsConnected(false);
        });
      }

      // 4. Stream to video element
      await client.streamToVideoElement("anam-avatar-video-feed");
      setIsConnected(true);
      setIsConnecting(false);
    } catch (err: any) {
      console.error("Anam WebRTC connection failed:", err);
      const isConcurrency =
        err?.message?.toLowerCase()?.includes("concurrency") ||
        err?.message?.toLowerCase()?.includes("limit");

      if (isConcurrency) {
        setErrorMsg(
          "Concurrency limit reached on Anam AI (1 active session allowed). A previous connection was still closing. Please wait 5 seconds and click Retry."
        );
        // Auto-recovery: retry after delay
        setCanRetry(false);
        setTimeout(() => setCanRetry(true), 5000);
      } else {
        setErrorMsg(err?.message || "Failed to establish WebRTC connection to avatar.");
      }

      setIsConnecting(false);
      onError?.(err);
    } finally {
      isInitializingRef.current = false;
    }
  }, [sessionToken, cleanupActiveSession, onError]);

  useEffect(() => {
    initSession();

    const handleBeforeUnload = () => {
      cleanupActiveSession();
    };
    window.addEventListener("beforeunload", handleBeforeUnload);

    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
      cleanupActiveSession();
    };
  }, [initSession, cleanupActiveSession]);

  const toggleMute = () => {
    if (clientRef.current) {
      try {
        if (isMuted) {
          if (typeof clientRef.current.unmuteInputAudio === "function") {
            clientRef.current.unmuteInputAudio();
          }
          setIsMuted(false);
        } else {
          if (typeof clientRef.current.muteInputAudio === "function") {
            clientRef.current.muteInputAudio();
          }
          setIsMuted(true);
        }
      } catch (e) {
        console.error("Mute error:", e);
      }
    }
  };

  const handleDisconnect = async () => {
    await cleanupActiveSession();
    setErrorMsg("Session ended. Click Retry to reconnect.");
  };

  return (
    <div className="relative w-full aspect-[4/3] md:aspect-video rounded-3xl overflow-hidden bg-slate-950 border border-slate-800 shadow-2xl flex items-center justify-center group">
      {/* Video Element for WebRTC Avatar Feed */}
      <video
        id="anam-avatar-video-feed"
        ref={videoRef}
        autoPlay
        playsInline
        className="w-full h-full object-cover"
      />

      {/* Top Header Overlay: Interviewer Badge & Audio Indicator */}
      <div className="absolute top-4 left-4 right-4 flex items-center justify-between pointer-events-none z-10">
        <div className="flex items-center gap-2.5 px-3.5 py-1.5 rounded-full bg-slate-900/80 backdrop-blur-md border border-slate-700/60 shadow-lg">
          <div className="relative flex items-center justify-center">
            <span
              className={`w-2.5 h-2.5 rounded-full ${isConnected
                ? isUserSpeaking
                  ? "bg-indigo-400 animate-ping"
                  : "bg-emerald-500"
                : "bg-amber-400 animate-pulse"
                }`}
            />
            <span
              className={`absolute w-2.5 h-2.5 rounded-full ${isConnected ? (isUserSpeaking ? "bg-indigo-400" : "bg-emerald-500") : "bg-amber-400"
                }`}
            />
          </div>
          <span className="text-xs font-semibold text-white tracking-wide flex items-center gap-1.5">
            {interviewerName}
            {isUserSpeaking && (
              <span className="text-[10px] uppercase font-bold text-indigo-300 tracking-wider bg-indigo-950/60 px-1.5 py-0.5 rounded-md border border-indigo-800/50">
                Listening to you
              </span>
            )}
          </span>
        </div>

        {isConnected && (
          <div className="px-3 py-1 rounded-full bg-slate-900/80 backdrop-blur-md border border-slate-700/60 shadow-lg flex items-center gap-1.5 text-xs text-slate-300">
            <Sparkles className="w-3.5 h-3.5 text-amber-400" />
            <span>Cara-4 HD</span>
          </div>
        )}
      </div>

      {/* Loading Overlay */}
      {isConnecting && !isConnected && (
        <div className="absolute inset-0 bg-slate-950/90 backdrop-blur-md flex flex-col items-center justify-center gap-4 text-white z-20">
          <div className="relative">
            <div className="w-14 h-14 rounded-full border-2 border-indigo-500/20 border-t-indigo-500 animate-spin" />
            <div className="absolute inset-0 flex items-center justify-center">
              <Volume2 className="w-6 h-6 text-indigo-400 animate-pulse" />
            </div>
          </div>
          <div className="text-center space-y-1">
            <p className="text-sm font-semibold text-white">Connecting with {interviewerName}...</p>
            <p className="text-xs text-slate-400">Setting up low-latency WebRTC video stream</p>
          </div>
        </div>
      )}

      {/* Error Overlay */}
      {errorMsg && (
        <div className="absolute inset-0 bg-slate-950/95 backdrop-blur-md flex flex-col items-center justify-center gap-3 p-6 text-center text-white z-30">
          <div className="w-12 h-12 rounded-full bg-rose-500/10 border border-rose-500/30 flex items-center justify-center text-rose-400">
            <AlertCircle className="w-6 h-6" />
          </div>
          <p className="text-sm font-semibold text-rose-200">Session Status</p>
          <p className="text-xs text-slate-300 max-w-sm leading-relaxed">{errorMsg}</p>
          <Button
            size="sm"
            onClick={initSession}
            variant="outline"
            disabled={!canRetry}
            className="mt-2 border-slate-700 bg-slate-900 hover:bg-slate-800 text-white gap-2"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${!canRetry ? "animate-spin" : ""}`} /> Reconnect Avatar
          </Button>
        </div>
      )}

      {/* Bottom Floating Control Bar */}
      {isConnected && (
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-3 px-4 py-2 rounded-2xl bg-slate-900/85 backdrop-blur-xl border border-slate-700/60 shadow-2xl z-10 transition-opacity">
          <button
            onClick={toggleMute}
            className={`p-2 rounded-xl transition-all ${isMuted
              ? "bg-rose-500/20 text-rose-400 hover:bg-rose-500/30"
              : "bg-slate-800 text-slate-200 hover:bg-slate-700"
              }`}
            title={isMuted ? "Unmute Microphone" : "Mute Microphone"}
          >
            {isMuted ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
          </button>
          <div className="h-4 w-px bg-slate-700" />
          <span className="text-xs text-slate-300 font-medium select-none">
            {isMuted ? "Mic Muted" : "Mic Live"}
          </span>
          <div className="h-4 w-px bg-slate-700" />
          <button
            onClick={handleDisconnect}
            className="p-2 rounded-xl bg-rose-500/20 text-rose-400 hover:bg-rose-500/30 transition-all flex items-center gap-1.5 text-xs font-semibold"
            title="End Avatar Stream"
          >
            <PhoneOff className="w-3.5 h-3.5" />
            <span>End Call</span>
          </button>
        </div>
      )}
    </div>
  );
}