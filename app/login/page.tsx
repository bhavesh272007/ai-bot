// TARGET PATH: app/login/page.tsx
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { Eye, EyeOff, Loader2, AlertCircle } from "lucide-react";
import styles from "./page.module.css";

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
    <div className={styles.page}>
      <nav className={styles.topNav}>
        <Link href="/" className={styles.logo}>
          <span className={styles.logoBadge}>AI</span>
          Interview Booth
        </Link>
        <Link href="/" className={styles.backHome}>← Back to home</Link>
      </nav>

      <div className={styles.authWrap}>
        <span className={styles.heroNote}>welcome back!</span>

        <div className={styles.authCard}>
          <span className={styles.eyebrow}>Recruiter access</span>
          <h1>Log in</h1>
          <p className={styles.authSub}>
            Get back to generating and tracking interviews for your candidates.
          </p>

          <div className={styles.field}>
            <label className={styles.fieldLabel}>Email</label>
            <div className={styles.inputWrap}>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleLogin()}
                className={styles.input}
                placeholder="you@company.com"
                autoComplete="email"
              />
            </div>
          </div>

          <div className={styles.field}>
            <label className={styles.fieldLabel}>Password</label>
            <div className={styles.inputWrap}>
              <input
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleLogin()}
                className={`${styles.input} ${styles.inputPassword}`}
                placeholder="••••••••"
                autoComplete="current-password"
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                tabIndex={-1}
                className={styles.eyeToggle}
                aria-label={showPassword ? "Hide password" : "Show password"}
              >
                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>

          <button
            type="button"
            onClick={handleLogin}
            disabled={loading || !email || !password}
            className={styles.submitBtn}
          >
            {loading && <Loader2 size={16} className={styles.spinner} />}
            {loading ? "Logging in…" : "Log In"}
          </button>

          {error && (
            <p className={styles.errorMsg}>
              <AlertCircle size={14} />
              {error}
            </p>
          )}

          <p className={styles.footNote}>
            Don&apos;t have an account?{" "}
            <Link href="/signup" className={styles.footLink}>Sign up</Link>
          </p>
        </div>
      </div>
    </div>
  );
}