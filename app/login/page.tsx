// TARGET PATH: app/login/page.tsx
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/lib/supabase";
import { Eye, EyeOff, Loader2, AlertCircle } from "lucide-react";

const inputClass =
  "w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground transition-colors focus:outline-none focus:ring-2 focus:ring-ring/40 focus:border-foreground";

export default function Login() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleLogin() {
    if (loading || !email || !password) return;
    setLoading(true);
    setError("");

    const { error: signInError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (signInError) {
      setError(signInError.message);
      setLoading(false);
      return;
    }

    router.push("/create");
  }

  return (
    <main className="min-h-screen bg-background flex items-center justify-center px-4">
      <Card className="max-w-sm w-full overflow-hidden pt-0">
        <div className="flex gap-1.5 px-6 pt-4 pb-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <div
              key={i}
              className="w-1.5 h-1.5 rounded-full bg-background border border-border"
            />
          ))}
        </div>
        <CardHeader>
          <p className="label-mono mb-1">Recruiter access</p>
          <CardTitle className="text-xl">Log in</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <label className="label-mono">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleLogin()}
              className={inputClass}
              placeholder="you@company.com"
              autoComplete="email"
            />
          </div>
          <div className="space-y-2">
            <label className="label-mono">Password</label>
            <div className="relative">
              <input
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleLogin()}
                className={`${inputClass} pr-10`}
                placeholder="••••••••"
                autoComplete="current-password"
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                tabIndex={-1}
                className="absolute inset-y-0 right-0 flex items-center px-3 text-muted-foreground hover:text-foreground transition-colors"
                aria-label={showPassword ? "Hide password" : "Show password"}
              >
                {showPassword ? (
                  <EyeOff className="h-4 w-4" />
                ) : (
                  <Eye className="h-4 w-4" />
                )}
              </button>
            </div>
          </div>

          <Button
            onClick={handleLogin}
            disabled={loading || !email || !password}
            className="w-full"
          >
            {loading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            {loading ? "Logging in..." : "Log In"}
          </Button>

          {error && (
            <p className="flex items-center justify-center gap-1.5 text-sm text-destructive text-center">
              <AlertCircle className="h-3.5 w-3.5 shrink-0" />
              {error}
            </p>
          )}

          <p className="text-sm text-muted-foreground text-center">
            Don&apos;t have an account?{" "}
            <a href="/signup" className="text-seal hover:underline font-medium">
              Sign up
            </a>
          </p>
          <p className="text-sm text-muted-foreground/70 text-center">
            <a href="/" className="hover:underline">
              ← Back to home
            </a>
          </p>
        </CardContent>
      </Card>
    </main>
  );
}
