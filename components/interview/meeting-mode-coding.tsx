// TARGET PATH: components/interview/meeting-mode-coding.tsx
"use client";

import { useState } from "react";
import {
  Mic,
  MicOff,
  MonitorUp,
  RotateCcw,
  Volume2,
  VolumeX,
  Loader2,
} from "lucide-react";
import { InterviewerAvatar } from "@/components/interviewer-avatar";
import { CandidateCamera } from "@/components/candidate-camera";
import {
  MeetingShell,
  MEETING_ICON_BUTTON,
  MEETING_PRIMARY_BUTTON,
  MEETING_SECONDARY_BUTTON,
} from "@/components/interview/meeting-shell";
import { MeetingTile, MicStatusPill } from "@/components/interview/meeting-tile";
import type { NetworkInfo } from "@/lib/voice/useNetworkInfo";

// Structural copies of the coding page's own types — kept local so this
// component imports nothing from the page it renders for.
interface CodingTestResult {
  input: string;
  expectedOutput: string;
  actualOutput: string;
  stderr: string;
  passed: boolean;
}

interface CodingTestCase {
  input: string;
  expectedOutput: string;
}

interface MeetingModeCodingProps {
  elapsedLabel: string;
  networkInfo: NetworkInfo;
  roleLabel: string;

  // ---- The presented "screen" ----
  title: string;
  prompt: string;
  testCases: CodingTestCase[];
  fileName: string; // "solution.js" — cosmetic editor tab label
  language: string;
  languageOptions: { value: string; label: string }[];
  onLanguageChange: (value: string) => void;
  code: string;
  onCodeChange: (value: string) => void;

  // ---- Run / submit ----
  testResults: CodingTestResult[] | null;
  testsPassed: number;
  testsTotal: number;
  runError: string;
  submitError: string;
  running: boolean;
  submitting: boolean;
  onRun: () => void;
  onSubmit: () => void;

  // ---- Interviewer ----
  lineText: string;
  revealedWordCount: number;
  avatarState: "idle" | "listening" | "speaking";
  speakTick: number;
  micLevel: number;
  voiceEnabled: boolean;
  onToggleVoice: () => void;
  onReplay: () => void;

  cameraEnabled: boolean;

  // ---- Think-aloud narration ----
  thinkAloud: string;
  voiceInputSupported: boolean;
  micAutoOn: boolean;
  onToggleMicAuto: () => void;
  isListening: boolean;
  usingFallback: boolean;
  transcribing: boolean;
  // True on browsers with no native SpeechRecognition, where narration would
  // otherwise mean uploading long stretches of silence to Whisper. There the
  // mic button starts and stops a single narration recording instead of
  // staying live, so the button needs different labelling.
  pushToTalk: boolean;
}

type Pane = "problem" | "code" | "tests";

const PANES: { value: Pane; label: string }[] = [
  { value: "problem", label: "Problem" },
  { value: "code", label: "Code" },
  { value: "tests", label: "Tests" },
];

// The coding round, still inside the call: the problem and editor are the
// interviewer's shared screen, and the video tiles shrink to a rail. Same
// contract as meeting-mode-call.tsx — presentation only, no interview logic,
// nothing passed in that isn't rendered.
export function MeetingModeCoding({
  elapsedLabel,
  networkInfo,
  roleLabel,
  title,
  prompt,
  testCases,
  fileName,
  language,
  languageOptions,
  onLanguageChange,
  code,
  onCodeChange,
  testResults,
  testsPassed,
  testsTotal,
  runError,
  submitError,
  running,
  submitting,
  onRun,
  onSubmit,
  lineText,
  revealedWordCount,
  avatarState,
  speakTick,
  micLevel,
  voiceEnabled,
  onToggleVoice,
  onReplay,
  cameraEnabled,
  thinkAloud,
  voiceInputSupported,
  micAutoOn,
  onToggleMicAuto,
  isListening,
  usingFallback,
  transcribing,
  pushToTalk,
}: MeetingModeCodingProps) {
  // Below md there isn't room for problem + editor + console at once, so they
  // become tabs. At md and up all three are visible and this state is ignored.
  const [pane, setPane] = useState<Pane>("problem");

  const words = lineText ? lineText.split(" ") : [];
  const revealedCaption = words.slice(0, revealedWordCount).join(" ");

  const micTitle = pushToTalk
    ? isListening
      ? "Stop narrating"
      : "Narrate your thinking"
    : micAutoOn
    ? "Turn mic off"
    : "Turn mic on";
  const micActive = pushToTalk ? isListening : micAutoOn;

  return (
    <MeetingShell
      lockViewport
      stageLabel="Coding round"
      elapsedLabel={elapsedLabel}
      networkInfo={networkInfo}
      footnote={null}
      controls={
        <>
          <button
            type="button"
            onClick={onReplay}
            title="Replay what the interviewer said"
            className={MEETING_ICON_BUTTON}
          >
            <RotateCcw className="h-4 w-4" />
          </button>

          <button
            type="button"
            onClick={onToggleVoice}
            title={voiceEnabled ? "Mute interviewer voice" : "Unmute interviewer voice"}
            className={MEETING_ICON_BUTTON}
          >
            {voiceEnabled ? <Volume2 className="h-4 w-4" /> : <VolumeX className="h-4 w-4" />}
          </button>

          {voiceInputSupported && (
            <button
              type="button"
              onClick={onToggleMicAuto}
              title={micTitle}
              className={`h-11 w-11 rounded-full border flex items-center justify-center transition-colors ${
                micActive
                  ? "border-emerald-500 text-emerald-400 bg-emerald-500/10"
                  : "border-neutral-700 text-neutral-500 hover:bg-neutral-900"
              }`}
            >
              {micActive ? <Mic className="h-4 w-4" /> : <MicOff className="h-4 w-4" />}
            </button>
          )}

          <button
            type="button"
            onClick={onRun}
            disabled={running || submitting}
            className={MEETING_SECONDARY_BUTTON}
          >
            {running ? "Running…" : "Run Code"}
          </button>

          <button
            type="button"
            onClick={onSubmit}
            disabled={running || submitting}
            className={MEETING_PRIMARY_BUTTON}
          >
            {submitting ? "Submitting…" : "Submit Solution"}
          </button>
        </>
      }
    >
      <div className="flex-1 min-h-0 flex flex-col lg:flex-row gap-3 px-3 sm:px-6 pb-3">
        {/* Video rail — a right-hand column on desktop, a filmstrip above the
            shared screen on smaller widths so the editor keeps full height. */}
        <div className="order-1 lg:order-2 shrink-0 flex lg:flex-col gap-3 h-24 md:h-32 lg:h-auto lg:w-70">
          <MeetingTile
            className="flex-col bg-slate-900 flex-1 lg:flex-none lg:h-48 min-w-0"
            caption={revealedCaption}
            captionClampClass="line-clamp-2 lg:line-clamp-4"
          >
            <div className="absolute -top-12 -right-12 w-48 h-48 rounded-full bg-teal-500/10 blur-3xl pointer-events-none" />
            <div className="absolute -bottom-12 -left-12 w-48 h-48 rounded-full bg-blue-600/10 blur-3xl pointer-events-none" />

            <InterviewerAvatar
              state={avatarState}
              micLevel={micLevel}
              speakTick={speakTick}
              surfaceClassName="fill-slate-900"
              size={72}
              fill
              roleLabel={roleLabel}
            />
          </MeetingTile>

          <MeetingTile
            className="bg-neutral-900 flex-1 lg:flex-none lg:h-40 min-w-0"
            statusPill={
              <MicStatusPill
                isListening={isListening}
                transcribing={transcribing}
                usingFallback={usingFallback}
              />
            }
          >
            {cameraEnabled ? (
              <CandidateCamera autoStart width={264} height={158} />
            ) : (
              <p className="text-neutral-600 text-xs">Camera is off</p>
            )}
          </MeetingTile>

          {/* Full narration log — desktop only. Narrower widths get the
              single-line strip below instead, which is easier to read than a
              tile squeezed into a filmstrip. */}
          <div className="hidden lg:flex flex-1 min-h-0 flex-col rounded-xl border border-neutral-800 bg-neutral-950">
            <div className="flex items-center justify-between px-3 py-2 border-b border-neutral-800 shrink-0">
              <span className="text-[10px] uppercase tracking-widest text-neutral-500">
                Think aloud
              </span>
              {transcribing && <Loader2 className="h-3 w-3 animate-spin text-neutral-500" />}
            </div>
            <div className="flex-1 min-h-0 overflow-y-auto px-3 py-2">
              {thinkAloud ? (
                <p className="text-xs text-neutral-300 leading-relaxed whitespace-pre-wrap">
                  {thinkAloud}
                </p>
              ) : (
                <p className="text-xs text-neutral-600 leading-relaxed">
                  {voiceInputSupported
                    ? "Talk through your approach as you work — the interviewer is listening."
                    : "Voice capture isn't available in this browser."}
                </p>
              )}
            </div>
          </div>
        </div>

        {/* The shared screen */}
        <div className="order-2 lg:order-1 flex-1 min-w-0 min-h-0 rounded-2xl border border-neutral-800 bg-neutral-950 flex flex-col overflow-hidden">
          <div className="flex items-center justify-between gap-3 border-b border-neutral-800 px-3 sm:px-4 py-2.5 shrink-0">
            <div className="flex items-center gap-2 min-w-0">
              <MonitorUp className="h-4 w-4 text-neutral-500 shrink-0" />
              <span className="hidden sm:inline text-[10px] uppercase tracking-widest text-neutral-500 shrink-0">
                Presenting
              </span>
              <span className="text-sm text-neutral-200 truncate">{title}</span>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <div className="flex md:hidden rounded-full border border-neutral-800 p-0.5">
                {PANES.map((p) => (
                  <button
                    key={p.value}
                    type="button"
                    onClick={() => setPane(p.value)}
                    className={`rounded-full px-2.5 py-1 text-[10px] transition-colors ${
                      pane === p.value
                        ? "bg-white text-black"
                        : "text-neutral-400 hover:text-neutral-200"
                    }`}
                  >
                    {p.label}
                  </button>
                ))}
              </div>

              <select
                value={language}
                onChange={(e) => onLanguageChange(e.target.value)}
                className="rounded-md border border-neutral-700 bg-neutral-900 px-2 py-1 text-xs text-neutral-200 font-mono focus:outline-none"
              >
                {languageOptions.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="flex-1 min-h-0 grid grid-cols-1 md:grid-cols-[minmax(240px,34%)_1fr]">
            {/* Problem */}
            <div
              className={`${
                pane === "problem" ? "flex" : "hidden"
              } md:flex flex-col min-h-0 md:border-r border-neutral-800`}
            >
              <div className="flex-1 min-h-0 overflow-y-auto px-4 py-3 space-y-4">
                <div className="space-y-2">
                  <p className="text-[10px] uppercase tracking-widest text-neutral-500">Problem</p>
                  <p className="text-sm text-neutral-300 leading-relaxed whitespace-pre-wrap">
                    {prompt}
                  </p>
                </div>

                {testCases.length > 0 && (
                  <div className="space-y-2">
                    <p className="text-[10px] uppercase tracking-widest text-neutral-500">
                      Sample tests
                    </p>
                    <div className="space-y-2">
                      {testCases.map((t, i) => (
                        <div
                          key={i}
                          className="rounded-lg border border-neutral-800 bg-black/40 px-3 py-2 space-y-0.5"
                        >
                          <p className="font-mono text-[11px] text-neutral-400 break-words">
                            in: {t.input || "(none)"}
                          </p>
                          <p className="font-mono text-[11px] text-neutral-400 break-words">
                            out: {t.expectedOutput}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Editor + console */}
            <div
              className={`${
                pane === "problem" ? "hidden" : "flex"
              } md:flex flex-col min-h-0 min-w-0`}
            >
              <div
                className={`${
                  pane === "tests" ? "hidden" : "flex"
                } md:flex flex-1 min-h-0 flex-col`}
              >
                <div className="flex items-center gap-2 px-4 py-1.5 border-b border-neutral-800/70 shrink-0">
                  <span className="font-mono text-[11px] text-neutral-500">{fileName}</span>
                </div>
                <textarea
                  value={code}
                  onChange={(e) => onCodeChange(e.target.value)}
                  spellCheck={false}
                  className="flex-1 min-h-0 w-full resize-none bg-neutral-950 text-neutral-100 font-mono text-sm px-4 py-3 leading-relaxed focus:outline-none"
                />
              </div>

              <div
                className={`${
                  pane === "code" ? "hidden" : "flex"
                } md:flex flex-col min-h-0 flex-1 md:flex-none md:h-40 border-t border-neutral-800`}
              >
                <div className="flex items-center justify-between px-4 py-1.5 border-b border-neutral-800/70 shrink-0">
                  <span className="text-[10px] uppercase tracking-widest text-neutral-500">
                    Console
                  </span>
                  {testResults && (
                    <span
                      className={`font-mono text-[11px] ${
                        testsPassed === testsTotal ? "text-emerald-400" : "text-amber-400"
                      }`}
                    >
                      {testsPassed}/{testsTotal} passed
                    </span>
                  )}
                </div>

                <div className="flex-1 min-h-0 overflow-y-auto px-4 py-2 font-mono text-[11px] leading-relaxed">
                  {runError && <p className="text-red-400">{runError}</p>}
                  {submitError && <p className="text-red-400">{submitError}</p>}

                  {!runError && !submitError && !testResults && (
                    <p className="text-neutral-600">
                      Run your code to see how it does against the sample tests.
                    </p>
                  )}

                  {testResults?.map((r, i) => (
                    <div key={i} className="py-0.5">
                      <span className={r.passed ? "text-emerald-400" : "text-red-400"}>
                        {r.passed ? "✓" : "✕"} test {i + 1}
                      </span>
                      {!r.passed && (
                        <span className="text-neutral-500">
                          {" "}
                          — expected {r.expectedOutput}, got{" "}
                          {r.actualOutput || r.stderr || "(no output)"}
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Narration strip — the rail's think-aloud tile, flattened for widths
          where the rail is a filmstrip. */}
      <div className="lg:hidden px-3 sm:px-6 pb-2 shrink-0">
        <div className="flex items-center gap-2 rounded-lg border border-neutral-800 bg-neutral-950 px-3 py-1.5">
          <span className="text-[10px] uppercase tracking-widest text-neutral-500 shrink-0">
            Think aloud
          </span>
          <p className="text-[11px] text-neutral-400 truncate">
            {thinkAloud || "Talk through your approach as you work."}
          </p>
        </div>
      </div>
    </MeetingShell>
  );
}
