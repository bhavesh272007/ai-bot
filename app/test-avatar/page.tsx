"use client";

import React, { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { VideoAvatar } from "@/components/video-avatar";
import { AnamAvatar } from "@/components/anam-avatar";
import {
  Sparkles,
  Video,
  Play,
  Volume2,
  Mic,
  MicOff,
  UserCheck,
  Bot,
  Square,
  Activity,
  Layers,
} from "lucide-react";
import Link from "next/link";
import { useTextToSpeech } from "@/lib/voice/useTextToSpeech";
import { useLipSync } from "@/lib/voice/useLipSync";

export default function TestAvatarPage() {
  // Avatar state controls
  const [avatarState, setAvatarState] = useState<"idle" | "listening" | "speaking">("idle");
  const [customSpeechText, setCustomSpeechText] = useState(
    "Hello Alex, welcome to your technical interview today. Can you tell me a little about your experience with Next.js, React, and building scalable full-stack applications?"
  );
  const [isListeningMic, setIsListeningMic] = useState(false);
  const [micTranscript, setMicTranscript] = useState("");
  const [chosenVoiceName, setChosenVoiceName] = useState<string>("");

  const { speak, cancel, isSpeaking, voices, selectedVoice } = useTextToSpeech();
  const { frame: lipSyncFrame, onBoundary, onSpeechEnd } = useLipSync();

  // Recognition ref
  const recognitionRef = useRef<any>(null);

  // Sync TTS speaking state to avatar state
  useEffect(() => {
    if (isSpeaking) {
      setAvatarState("speaking");
    } else if (avatarState === "speaking") {
      setAvatarState("listening");
    }
  }, [isSpeaking]);

  // Clean up
  useEffect(() => {
    return () => {
      cancel();
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }
    };
  }, [cancel]);

  // Handle Play Speech using persona tuned useTextToSpeech
  function handlePlaySpeech() {
    speak(customSpeechText, {
      voiceName: chosenVoiceName || selectedVoice?.name,
      rate: 0.98,
      pitch: 1.04,
      onBoundary: (charIndex, text) => {
        onBoundary(charIndex, text);
      },
      onEnd: () => {
        onSpeechEnd();
        setAvatarState("listening");
      },
    });
  }

  function handleStopSpeech() {
    cancel();
    onSpeechEnd();
    setAvatarState("idle");
  }

  // Web Speech API - Free STT Mic test
  function handleToggleMic() {
    if (typeof window === "undefined") return;

    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (!SpeechRecognition) {
      alert("Speech Recognition API is not supported in this browser. Please use Chrome or Edge.");
      return;
    }

    if (isListeningMic) {
      recognitionRef.current?.stop();
      setIsListeningMic(false);
      setAvatarState("idle");
      return;
    }

    try {
      const recognition = new SpeechRecognition();
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = "en-US";

      recognition.onstart = () => {
        setIsListeningMic(true);
        setAvatarState("listening");
      };

      recognition.onresult = (event: any) => {
        let currentTranscript = "";
        for (let i = 0; i < event.results.length; i++) {
          currentTranscript += event.results[i][0].transcript;
        }
        setMicTranscript(currentTranscript);
      };

      recognition.onerror = (event: any) => {
        console.error("Mic error:", event.error);
        setIsListeningMic(false);
        setAvatarState("idle");
      };

      recognition.onend = () => {
        setIsListeningMic(false);
      };

      recognitionRef.current = recognition;
      recognition.start();
    } catch (err) {
      console.error(err);
      setIsListeningMic(false);
    }
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col items-center justify-start p-4 md:p-8">
      {/* Top Navbar */}
      <div className="w-full max-w-6xl flex items-center justify-between py-4 border-b border-slate-800 mb-8">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-emerald-500 to-teal-500 flex items-center justify-center text-white font-bold shadow-lg shadow-emerald-500/20">
            <Video className="w-5 h-5" />
          </div>
          <div>
            <h1 className="font-bold text-lg text-white">Free Dual-Buffer Video Avatar</h1>
            <p className="text-xs text-slate-400">Zero-cost, Zero-GPU, Real-time state machine</p>
          </div>
        </div>

        <Link href="/">
          <Button variant="outline" size="sm" className="border-slate-800 text-slate-300 hover:text-white">
            Back to Home
          </Button>
        </Link>
      </div>

      <div className="w-full max-w-6xl grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Left Column: Interactive Controls */}
        <div className="lg:col-span-5 flex flex-col gap-6">
          <Card className="bg-slate-900/90 border-slate-800 shadow-xl backdrop-blur-md">
            <CardHeader className="pb-4">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base font-semibold text-white flex items-center gap-2">
                  <Activity className="w-4 h-4 text-emerald-400" />
                  Avatar State Controls
                </CardTitle>
                <Badge
                  variant="outline"
                  className={
                    avatarState === "speaking"
                      ? "border-emerald-500 text-emerald-400 bg-emerald-500/10"
                      : avatarState === "listening"
                      ? "border-blue-500 text-blue-400 bg-blue-500/10"
                      : "border-slate-700 text-slate-400"
                  }
                >
                  Current: {avatarState.toUpperCase()}
                </Badge>
              </div>
              <CardDescription className="text-xs text-slate-400">
                Click any state below to see the instant, zero-flicker video cross-fade.
              </CardDescription>
            </CardHeader>

            <CardContent className="space-y-5">
              {/* Manual State Switcher */}
              <div className="grid grid-cols-3 gap-2">
                <Button
                  type="button"
                  size="sm"
                  variant={avatarState === "idle" ? "default" : "outline"}
                  onClick={() => setAvatarState("idle")}
                  className={
                    avatarState === "idle"
                      ? "bg-slate-700 hover:bg-slate-600 text-white"
                      : "border-slate-800 text-slate-300 hover:bg-slate-800"
                  }
                >
                  Idle
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant={avatarState === "listening" ? "default" : "outline"}
                  onClick={() => setAvatarState("listening")}
                  className={
                    avatarState === "listening"
                      ? "bg-blue-600 hover:bg-blue-500 text-white"
                      : "border-slate-800 text-blue-300 hover:bg-blue-950/40"
                  }
                >
                  Listening
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant={avatarState === "speaking" ? "default" : "outline"}
                  onClick={() => setAvatarState("speaking")}
                  className={
                    avatarState === "speaking"
                      ? "bg-emerald-600 hover:bg-emerald-500 text-white"
                      : "border-slate-800 text-emerald-300 hover:bg-emerald-950/40"
                  }
                >
                  Speaking
                </Button>
              </div>

              {/* TTS Speech Test */}
              <div className="space-y-3 pt-2 border-t border-slate-800">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-medium text-slate-300">
                    Interviewer Voice (Persona Matched)
                  </label>
                  <span className="text-[10px] text-emerald-400 font-mono">
                    {selectedVoice ? "✓ Persona Matched" : "Detecting voices..."}
                  </span>
                </div>

                {voices.length > 0 && (
                  <select
                    value={chosenVoiceName || selectedVoice?.name || ""}
                    onChange={(e) => setChosenVoiceName(e.target.value)}
                    className="w-full text-xs bg-slate-950 border border-slate-800 rounded-lg p-2 text-slate-200 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                  >
                    {voices.map((v) => (
                      <option key={v.name} value={v.name}>
                        {v.name} ({v.lang}) {v.name === selectedVoice?.name ? "★ Recommended" : ""}
                      </option>
                    ))}
                  </select>
                )}

                <Textarea
                  rows={3}
                  value={customSpeechText}
                  onChange={(e) => setCustomSpeechText(e.target.value)}
                  placeholder="Enter text for Sarah to speak..."
                  className="bg-slate-950 border-slate-800 text-white focus-visible:ring-emerald-500 text-xs"
                />

                <div className="flex gap-2">
                  <Button
                    type="button"
                    disabled={isSpeaking}
                    onClick={handlePlaySpeech}
                    className="flex-1 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold shadow-lg shadow-emerald-500/20"
                  >
                    <Volume2 className="w-3.5 h-3.5 mr-2" />
                    Speak Text (Sync with Avatar)
                  </Button>

                  {isSpeaking && (
                    <Button
                      type="button"
                      variant="destructive"
                      size="sm"
                      onClick={handleStopSpeech}
                    >
                      <Square className="w-3.5 h-3.5 fill-current" />
                    </Button>
                  )}
                </div>
              </div>

              {/* Mic STT Test */}
              <div className="space-y-2 pt-2 border-t border-slate-800">
                <label className="text-xs font-medium text-slate-300 flex items-center justify-between">
                  <span>Candidate Mic Input (STT Test)</span>
                  <span className="text-[10px] text-slate-500">Free SpeechRecognition</span>
                </label>

                <Button
                  type="button"
                  variant="outline"
                  onClick={handleToggleMic}
                  className={`w-full text-xs font-medium border transition-colors ${
                    isListeningMic
                      ? "border-rose-500 bg-rose-500/10 text-rose-400 hover:bg-rose-500/20 animate-pulse"
                      : "border-slate-800 text-slate-300 hover:bg-slate-800"
                  }`}
                >
                  {isListeningMic ? (
                    <>
                      <MicOff className="w-3.5 h-3.5 mr-2 text-rose-400" />
                      Listening... Click to Stop
                    </>
                  ) : (
                    <>
                      <Mic className="w-3.5 h-3.5 mr-2 text-blue-400" />
                      Test Your Microphone (Put Sarah in Listening)
                    </>
                  )}
                </Button>

                {micTranscript && (
                  <div className="p-2.5 rounded-lg bg-slate-950 border border-slate-800/80 text-[11px] font-mono text-slate-300 max-h-24 overflow-y-auto">
                    <span className="text-slate-500 font-bold block mb-1">Live Transcript:</span>
                    {micTranscript}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Architecture Card */}
          <Card className="bg-slate-900/60 border-slate-800 shadow-lg">
            <CardHeader className="pb-3">
              <CardTitle className="text-xs font-semibold text-slate-300 flex items-center gap-2">
                <Layers className="w-3.5 h-3.5 text-indigo-400" />
                Under the Hood: Dual-Buffer Video
              </CardTitle>
            </CardHeader>
            <CardContent className="text-xs text-slate-400 space-y-2 leading-relaxed">
              <p>
                • <strong>Base Video Layer:</strong> <code>/interviewer-idle.mp4</code> loops quietly in background.
              </p>
              <p>
                • <strong>Speaking Overlay:</strong> <code>/interviewer-talk.mp4</code> cross-fades with a 200ms GPU opacity transition when speech triggers.
              </p>
              <p>
                • <strong>Phoneme Lip Sync:</strong> A canvas overlay reads <code>onboundary</code> events from the Web Speech API and animates mouth shapes (A, E, I, O, U, B, F) at 60 fps — zero cost, zero GPU.
              </p>
              <p>
                • <strong>Zero Latency:</strong> No cloud WebRTC latency, no server GPU subscription.
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Right Column: Live Video Avatar */}
        <div className="lg:col-span-7 flex flex-col items-center justify-start gap-4">
            {/* The Dual-Video Avatar Component in Authentic Zoom Style */}
            <VideoAvatar
              state={avatarState}
              interviewerName="Sarah Miller"
              roleLabel="Lead Technical Recruiter"
              idleVideoUrl="/interviewer-idle.mp4"
              speakingVideoUrl="/interviewer-talk.mp4"
              caption={avatarState === "speaking" ? customSpeechText : undefined}
              showControls={true}
              isMuted={!isListeningMic}
              onToggleMute={handleToggleMic}
              cameraEnabled={true}
              onEndCall={handleStopSpeech}
              lipSyncFrame={lipSyncFrame}
              mouthTopPct={72}
              mouthWidthPct={18}
            />

            <div className="flex items-center justify-between text-xs text-slate-400 px-2 w-full">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                <span>Dual-Buffer + Phoneme Lip Sync Active (60fps)</span>
              </div>
              <span className="font-mono text-slate-500 text-[11px]">Next.js HTML5 Hardware Compositor</span>
            </div>
        </div>
      </div>
    </div>
  );
}
