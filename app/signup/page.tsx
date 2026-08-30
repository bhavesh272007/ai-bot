// TARGET PATH: app/signup/page.tsx
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { Eye, EyeOff, Loader2, AlertCircle, MailCheck } from "lucide-react";
import styles from "./page.module.css";

export default function Signup() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [checkEmail, setCheckEmail] = useState(false);

  async function handleSignup() {
    if (loading || !email || password.length < 6) return;
    setLoading(true);
    setError("");

    const { data, error: signUpError } = await supabase.auth.signUp({
      email,
      password,
    });

    if (signUpError) {
      setError(signUpError.message);
      setLoading(false);
      return;
    }

    if (data.session) {
      router.push("/create");
    } else {
      setCheckEmail(true);
      setLoading(false);
    }
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
        <span className={styles.heroNote}>hello!</span>

        <div className={styles.authCard}>
          <span className={styles.eyebrow}>New recruiter</span>
          <h1>Create account</h1>
          {!checkEmail && (
            <p className={styles.authSub}>
              Generate tailored interviews and share them with candidates in minutes.
            </p>
          )}

          {checkEmail ? (
            <div className={styles.successBox}>
              <div className={styles.successIconWrap}>
                <MailCheck size={22} />
              </div>
              <p>Account created. Check your email to confirm before logging in.</p>
            </div>
          ) : (
            <>
              <div className={styles.field}>
                <label className={styles.fieldLabel}>Email</label>
                <div className={styles.inputWrap}>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
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
                    onKeyDown={(e) => e.key === "Enter" && handleSignup()}
                    className={`${styles.input} ${styles.inputPassword}`}
                    placeholder="At least 6 characters"
                    autoComplete="new-password"
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
                onClick={handleSignup}
                disabled={loading || !email || password.length < 6}
                className={styles.submitBtn}
              >
                {loading && <Loader2 size={16} className={styles.spinner} />}
                {loading ? "Creating account…" : "Sign Up"}
              </button>

              {error && (
                <p className={styles.errorMsg}>
                  <AlertCircle size={14} />
                  {error}
                </p>
              )}
            </>
          )}

          <p className={styles.footNote}>
            Already have an account?{" "}
            <Link href="/login" className={styles.footLink}>Log in</Link>
          </p>
        </div>
      </div>
    </div>
  );
}