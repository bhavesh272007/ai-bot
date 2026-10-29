// components/lip-sync-canvas.tsx
// A lightweight canvas that draws an animated mouth shape over a video avatar.
// Mount it absolutely over the interviewer video and pass the LipSyncFrame
// produced by useLipSync().

"use client";

import React, { useRef, useEffect } from "react";
import type { LipSyncFrame } from "@/lib/voice/useLipSync";

interface LipSyncCanvasProps {
  frame: LipSyncFrame;
  isSpeaking: boolean;
  /** Position of the mouth within the canvas as % from top (default 72 — suits
   *  a typical head-and-shoulders framing where chin is at ~75%). */
  mouthTopPct?: number;
  /** Width of the mouth ellipse as % of canvas width (default 18). */
  mouthWidthPct?: number;
  className?: string;
}

// Base height of the mouth ellipse in px when openness = 1
const BASE_HEIGHT = 28;
// Natural idle micro-animation amplitude (px)
const IDLE_AMPLITUDE = 1.2;
const IDLE_SPEED = 0.6; // Hz

export function LipSyncCanvas({
  frame,
  isSpeaking,
  mouthTopPct = 72,
  mouthWidthPct = 18,
  className = "",
}: LipSyncCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef = useRef<number | null>(null);
  const tRef = useRef(0);
  // Smoothed openness for butter-smooth animation
  const smoothRef = useRef({ openness: 0, widthStretch: 1 });

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const draw = (timestamp: number) => {
      tRef.current = timestamp / 1000;
      const t = tRef.current;

      // Resize canvas to match display size
      const { width, height } = canvas.getBoundingClientRect();
      if (canvas.width !== width || canvas.height !== height) {
        canvas.width = width;
        canvas.height = height;
      }

      ctx.clearRect(0, 0, canvas.width, canvas.height);

      const target = frame.openness;
      const targetW = frame.widthStretch;

      // Exponential smoothing — lerp toward target each frame
      const alpha = isSpeaking ? 0.28 : 0.12;
      smoothRef.current.openness += (target - smoothRef.current.openness) * alpha;
      smoothRef.current.widthStretch += (targetW - smoothRef.current.widthStretch) * alpha;

      const smooth = smoothRef.current;

      // Idle micro-animation when not speaking (subtle breath)
      const idleWave = isSpeaking
        ? 0
        : Math.sin(2 * Math.PI * IDLE_SPEED * t) * IDLE_AMPLITUDE * 0.02;

      const cx = canvas.width / 2;
      const cy = canvas.height * (mouthTopPct / 100);

      // Ellipse dimensions
      const halfW = (canvas.width * (mouthWidthPct / 100)) * smooth.widthStretch;
      const halfH = BASE_HEIGHT * (smooth.openness + idleWave) * (canvas.height / 400);
      const lipH = Math.max(0.5, halfH); // always at least a thin line

      // Draw outer lip shape
      ctx.save();

      // Shadow / soft glow when speaking
      if (isSpeaking && smooth.openness > 0.05) {
        ctx.shadowColor = "rgba(16, 185, 129, 0.45)";
        ctx.shadowBlur = 12;
      }

      // Upper lip — darker rose
      const lipGrad = ctx.createLinearGradient(cx, cy - lipH, cx, cy + lipH);
      lipGrad.addColorStop(0, "rgba(200, 120, 120, 0.92)");
      lipGrad.addColorStop(0.45, "rgba(220, 100, 100, 0.88)");
      lipGrad.addColorStop(1, "rgba(170, 80, 80, 0.90)");

      ctx.beginPath();
      ctx.ellipse(cx, cy, halfW, lipH, 0, 0, 2 * Math.PI);
      ctx.fillStyle = lipGrad;
      ctx.fill();

      // Mouth cavity (dark interior — only visible when open)
      if (smooth.openness > 0.06) {
        const cavityH = lipH * 0.65;
        const cavityGrad = ctx.createRadialGradient(cx, cy, 0, cx, cy, halfW * 0.8);
        cavityGrad.addColorStop(0, "rgba(10, 5, 5, 0.92)");
        cavityGrad.addColorStop(0.6, "rgba(25, 8, 8, 0.85)");
        cavityGrad.addColorStop(1, "rgba(60, 20, 20, 0.0)");

        ctx.beginPath();
        ctx.ellipse(cx, cy + lipH * 0.08, halfW * 0.82, cavityH, 0, 0, 2 * Math.PI);
        ctx.fillStyle = cavityGrad;
        ctx.fill();

        // Teeth hint (only when wide open)
        if (smooth.openness > 0.25) {
          const teethOpacity = Math.min(1, (smooth.openness - 0.25) / 0.4);
          ctx.beginPath();
          ctx.ellipse(cx, cy - lipH * 0.15, halfW * 0.55, cavityH * 0.45, 0, 0, 2 * Math.PI);
          ctx.fillStyle = `rgba(245, 240, 235, ${teethOpacity * 0.85})`;
          ctx.fill();
        }
      }

      // Lip highlight (top sheen)
      if (smooth.openness > 0.02 || !isSpeaking) {
        ctx.beginPath();
        ctx.ellipse(cx, cy - lipH * 0.3, halfW * 0.5, lipH * 0.22, 0, 0, 2 * Math.PI);
        ctx.fillStyle = "rgba(255, 200, 200, 0.25)";
        ctx.fill();
      }

      ctx.restore();

      rafRef.current = requestAnimationFrame(draw);
    };

    rafRef.current = requestAnimationFrame(draw);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [frame, isSpeaking, mouthTopPct, mouthWidthPct]);

  return (
    <canvas
      ref={canvasRef}
      className={`absolute inset-0 w-full h-full pointer-events-none z-5 ${className}`}
      style={{ mixBlendMode: "normal" }}
    />
  );
}
