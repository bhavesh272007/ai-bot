// TARGET PATH: components/career-chat-widget.tsx
"use client";

import { useState, useRef, useEffect, FormEvent } from "react";
import { Plus, ArrowUp, FileText, X, Loader2, AlertCircle } from "lucide-react";
import { extractResumeText, truncateResumeText } from "@/lib/resume-parser";

interface Message {
  role: "user" | "assistant";
  content: string;
}

const STARTER_PROMPTS = [
  "How do I prepare for a technical interview in 2 weeks?",
  "What should I highlight in my resume as a fresher?",
  "How do I answer 'Tell me about yourself'?",
];

interface CareerChatWidgetProps {
  compact?: boolean;
}

export default function CareerChatWidget({ compact = false }: CareerChatWidgetProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Resume attachment state — extracted client-side, never persisted, matches the
  // existing resume-upload flow used in the interview intro screen.
  const [resumeText, setResumeText] = useState<string | null>(null);
  const [resumeFileName, setResumeFileName] = useState<string | null>(null);
  const [extracting, setExtracting] = useState(false);
  const [resumeError, setResumeError] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Resume upload hint — shows once on load, disappears after the first message is sent
  // (or if the user dismisses it manually via the X).
  const [hintDismissed, setHintDismissed] = useState(false);
  const showResumeHint = messages.length === 0 && !hintDismissed;

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, loading]);

  async function handleFile(file: File) {
    setResumeError("");
    setExtracting(true);
    setResumeFileName(file.name);

    try {
      const rawText = await extractResumeText(file);
      const truncated = truncateResumeText(rawText);
      setResumeText(truncated);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to read that file.";
      setResumeError(message);
      setResumeFileName(null);
      setResumeText(null);
    } finally {
      setExtracting(false);
    }
  }

  function handleRemoveResume() {
    setResumeText(null);
    setResumeFileName(null);
    setResumeError("");
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  async function sendMessage(text: string) {
    if (!text.trim() || loading) return;

    const userMsg: Message = { role: "user", content: text.trim() };
    const nextMessages = [...messages, userMsg];
    setMessages(nextMessages);
    setInput("");
    setError(null);
    setLoading(true);

    try {
      const res = await fetch("/api/career-chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: nextMessages,
          resumeContext: resumeText || undefined,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data?.error ?? "Something went wrong. Please try again.");
        setLoading(false);
        return;
      }

      setMessages((prev) => [...prev, { role: "assistant", content: data.reply }]);
    } catch {
      setError("Network error. Please check your connection and try again.");
    } finally {
      setLoading(false);
    }
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    sendMessage(input);
  }

  function handleClearChat() {
    setMessages([]);
    setError(null);
  }

  return (
    <div className="border border-border rounded-xl bg-background flex flex-col overflow-hidden w-full h-full">
      {/* Header */}
      {!compact && (
        <div className="px-6 py-4 text-center border-b border-border shrink-0">
          <p className="label-mono text-seal mb-1">Career Guidance Desk</p>
          <h1 className="font-heading font-bold text-lg text-foreground">Ask About Your Placement Prep</h1>
          <p className="text-xs text-muted-foreground mt-1">General guidance only — no login needed.</p>
        </div>
      )}
      {compact && (
        <div className="px-4 py-3 border-b border-border shrink-0 flex items-center justify-between">
          <p className="label-mono text-seal">Career Guidance</p>
          {messages.length > 0 && (
            <button onClick={handleClearChat} className="text-xs text-muted-foreground hover:text-foreground transition-colors">
              Clear
            </button>
          )}
        </div>
      )}

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 min-h-0 overflow-y-auto px-4 py-4 space-y-3">
        {messages.length === 0 && (
          <div className="space-y-2">
            <p className="text-sm text-muted-foreground text-center pt-6">
              Ask a question, or try one of these:
            </p>
            <div className="flex flex-col gap-2">
              {STARTER_PROMPTS.map((prompt) => (
                <button
                  key={prompt}
                  onClick={() => sendMessage(prompt)}
                  className="text-left text-sm border border-border rounded-2xl px-4 py-2.5 text-foreground hover:border-seal hover:bg-accent transition-colors"
                >
                  {prompt}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((m, i) => (
          <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
            <div
              className={`max-w-[80%] rounded-3xl px-4 py-2.5 text-sm whitespace-pre-wrap ${
                m.role === "user"
                  ? "bg-card border border-border text-foreground"
                  : "bg-seal text-background"
              }`}
            >
              {m.content}
            </div>
          </div>
        ))}

        {loading && (
          <div className="flex justify-start">
            <div className="bg-seal text-background rounded-3xl px-4 py-2.5 text-sm opacity-70">Typing...</div>
          </div>
        )}

        {error && (
          <div className="text-sm text-destructive border border-destructive rounded-2xl px-4 py-2.5">{error}</div>
        )}
      </div>

      {/* Resume attachment chip - shows above the input once a file is selected */}
      {(resumeFileName || resumeError) && (
        <div className="px-3 pt-2 shrink-0">
          {resumeFileName && (
            <div className="flex items-center gap-2 border border-border rounded-full px-3 py-1.5 bg-card w-fit max-w-full">
              {extracting ? (
                <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin text-muted-foreground" />
              ) : (
                <FileText className="h-3.5 w-3.5 shrink-0 text-verified" />
              )}
              <span className="text-xs text-foreground truncate">{resumeFileName}</span>
              {!extracting && (
                <button
                  type="button"
                  onClick={handleRemoveResume}
                  aria-label="Remove resume"
                  className="text-muted-foreground hover:text-foreground transition-colors shrink-0"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
          )}
          {resumeError && (
            <p className="flex items-center gap-1.5 text-xs text-destructive mt-1">
              <AlertCircle className="h-3 w-3 shrink-0" />
              {resumeError}
            </p>
          )}
        </div>
      )}

      {/* Resume upload hint - visible until first message is sent or dismissed */}
      {showResumeHint && (
        <div className="px-3 pt-1 shrink-0">
          <div className="flex items-center gap-2 border border-seal/50 bg-accent text-accent-foreground rounded-2xl px-3 py-2 text-xs">
            <span className="flex-1">💡 Tip: You can upload your resume for more personalized guidance! Click + icon to do so.</span>
            <button
              type="button"
              onClick={() => setHintDismissed(true)}
              aria-label="Dismiss tip"
              className="shrink-0 text-accent-foreground/70 hover:text-accent-foreground transition-colors"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      )}

      {/* Floating capsule input with gradient glow border */}
      <div className="p-3 shrink-0">
        <div className="rounded-full p-[1.5px] bg-gradient-to-r from-seal via-accent-foreground to-seal">
          <form onSubmit={handleSubmit} className="flex items-center gap-1.5 bg-background rounded-full pl-1.5 pr-1.5 py-1.5">
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              aria-label="Attach resume"
              title="Attach resume for personalized guidance"
              disabled={extracting}
              className="shrink-0 w-8 h-8 rounded-full bg-muted flex items-center justify-center text-muted-foreground hover:text-foreground disabled:opacity-40 transition-colors"
            >
              <Plus className="w-4 h-4" />
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf,.docx,.txt"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) handleFile(file);
              }}
            />
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Send message..."
              disabled={loading}
              className="flex-1 bg-transparent px-1 py-2 text-sm text-foreground placeholder:text-muted-foreground outline-none disabled:opacity-50"
            />
            <button
              type="submit"
              disabled={loading || !input.trim()}
              aria-label="Send message"
              className="shrink-0 w-9 h-9 rounded-full bg-seal text-background flex items-center justify-center disabled:opacity-40 hover:opacity-90 transition-opacity"
            >
              <ArrowUp className="w-4 h-4" />
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}