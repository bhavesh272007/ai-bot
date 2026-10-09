"use client";

import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AnamAvatar } from "@/components/anam-avatar";
import { Loader2, Sparkles, Video, Play, ArrowRight, UserCheck, Bot, CheckCircle2 } from "lucide-react";
import Link from "next/link";

export default function TestAvatarPage() {
  const [role, setRole] = useState("Full Stack Developer");
  const [level, setLevel] = useState("Mid-level (3-5 Yrs)");
  const [company, setCompany] = useState("Tech Company");
  const [candidateName, setCandidateName] = useState("Alex");
  const [resumeSummary, setResumeSummary] = useState(
    "Proficient in Next.js, React, Node.js, PostgreSQL, and REST APIs. Built real-time collaborative web applications."
  );

  const [loading, setLoading] = useState(false);
  const [sessionToken, setSessionToken] = useState<string | null>(null);
  const [questions, setQuestions] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleStartInterview(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/anam-session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          candidateName,
          targetRole: role,
          targetLevel: level,
          targetCompany: company,
          resumeSummary,
          interviewerName: "Sarah Miller",
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to start session");
      }

      setSessionToken(data.sessionToken);
      setQuestions(data.questions);
    } catch (err: any) {
      console.error(err);
      setError(err.message || "Failed to start interview session");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col items-center justify-start p-4 md:p-8">
      {/* Top Navbar */}
      <div className="w-full max-w-6xl flex items-center justify-between py-4 border-b border-slate-800 mb-8">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-indigo-500 to-purple-500 flex items-center justify-center text-white font-bold shadow-lg shadow-indigo-500/20">
            <Video className="w-5 h-5" />
          </div>
          <div>
            <h1 className="font-bold text-lg text-white">AI Interview Booth — Live Avatar</h1>
            <p className="text-xs text-slate-400">Powered by Anam AI (Cara-4) & Groq LLM</p>
          </div>
        </div>

        <Link href="/">
          <Button variant="outline" size="sm" className="border-slate-800 text-slate-300 hover:text-white">
            Back to Home
          </Button>
        </Link>
      </div>

      <div className="w-full max-w-6xl grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Left Column: Interview Settings / Questions */}
        <div className="lg:col-span-5 flex flex-col gap-6">
          <Card className="bg-slate-900/90 border-slate-800 shadow-xl backdrop-blur-md">
            <CardHeader className="pb-4">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base font-semibold text-white flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-indigo-400" />
                  Interview Setup
                </CardTitle>
                <Badge variant="secondary" className="bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
                  Sarah Miller
                </Badge>
              </div>
              <CardDescription className="text-xs text-slate-400">
                Groq generates tailored questions, then Sarah conducts the live interview over WebRTC.
              </CardDescription>
            </CardHeader>

            <CardContent>
              <form onSubmit={handleStartInterview} className="space-y-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-slate-300">Candidate Name</label>
                  <Input
                    value={candidateName}
                    onChange={(e) => setCandidateName(e.target.value)}
                    placeholder="e.g. Alex Sharma"
                    className="bg-slate-950 border-slate-800 text-white focus-visible:ring-indigo-500"
                    required
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-slate-300">Target Role</label>
                    <Input
                      value={role}
                      onChange={(e) => setRole(e.target.value)}
                      placeholder="e.g. Frontend Engineer"
                      className="bg-slate-950 border-slate-800 text-white focus-visible:ring-indigo-500"
                      required
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-slate-300">Target Level</label>
                    <Input
                      value={level}
                      onChange={(e) => setLevel(e.target.value)}
                      placeholder="e.g. Senior / L5"
                      className="bg-slate-950 border-slate-800 text-white focus-visible:ring-indigo-500"
                      required
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-slate-300">Candidate Skills / Resume Highlights</label>
                  <Textarea
                    rows={3}
                    value={resumeSummary}
                    onChange={(e) => setResumeSummary(e.target.value)}
                    placeholder="Key projects, skills, or experience..."
                    className="bg-slate-950 border-slate-800 text-white focus-visible:ring-indigo-500 text-xs"
                  />
                </div>

                {error && (
                  <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs">
                    {error}
                  </div>
                )}

                <Button
                  type="submit"
                  disabled={loading}
                  className="w-full bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 text-white font-medium py-2.5 rounded-xl shadow-lg shadow-indigo-500/25 transition-all"
                >
                  {loading ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Generating Questions & Starting...
                    </>
                  ) : (
                    <>
                      <Play className="w-4 h-4 mr-2 fill-current" />
                      {sessionToken ? "Restart Live Interview" : "Start Live Video Interview"}
                    </>
                  )}
                </Button>
              </form>
            </CardContent>
          </Card>

          {/* Generated Questions Card */}
          {questions && (
            <Card className="bg-slate-900/60 border-slate-800 shadow-lg">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-semibold text-slate-200 flex items-center gap-2">
                  <Bot className="w-4 h-4 text-emerald-400" />
                  Groq-Generated Interview Plan
                </CardTitle>
                <CardDescription className="text-xs text-slate-400">
                  Sarah has received this question agenda for today's session:
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="bg-slate-950/80 p-3.5 rounded-xl border border-slate-800/80 text-xs text-slate-300 whitespace-pre-wrap font-mono leading-relaxed max-h-56 overflow-y-auto">
                  {questions}
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Right Column: Live Video Booth */}
        <div className="lg:col-span-7 flex flex-col items-center justify-start gap-4">
          {sessionToken ? (
            <div className="w-full flex flex-col gap-3">
              <AnamAvatar sessionToken={sessionToken} interviewerName="Sarah Miller" />

              <div className="flex items-center justify-between text-xs text-slate-400 px-2">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                  <span>Bidirectional Audio + HD Video Active</span>
                </div>
                <span>Speak naturally to respond</span>
              </div>
            </div>
          ) : (
            <div className="w-full aspect-[4/3] md:aspect-video rounded-3xl border border-dashed border-slate-800 bg-slate-900/40 flex flex-col items-center justify-center p-8 text-center text-slate-400 gap-4">
              <div className="w-16 h-16 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400">
                <UserCheck className="w-8 h-8" />
              </div>
              <div className="space-y-1.5 max-w-sm">
                <h3 className="text-base font-semibold text-white">Live Avatar Ready to Connect</h3>
                <p className="text-xs text-slate-400">
                  Fill in your candidate details on the left and click <strong>Start Live Video Interview</strong> to begin your conversation with Sarah Miller.
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
