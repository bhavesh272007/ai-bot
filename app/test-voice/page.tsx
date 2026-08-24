// TARGET PATH: app/test-voice/page.tsx
"use client";

import { useState } from "react";
import Link from "next/link";
import { Playfair_Display, Inter, Caveat } from "next/font/google";
import { MicCheckCard } from "@/components/voice/MicCheckCard";
import styles from "./page.module.css";

const playfair = Playfair_Display({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  style: ["normal", "italic"],
  variable: "--font-playfair",
});
const inter = Inter({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-inter",
});
const caveat = Caveat({
  subsets: ["latin"],
  weight: ["600"],
  variable: "--font-caveat",
});

const TIPS = [
  "Find a quiet room — background noise makes speech recognition less reliable.",
  "Allow microphone access when your browser asks — this only runs locally.",
  "Speak at a normal pace and volume, the same way you would in the real interview.",
];

export default function TestVoicePage() {
  const [verified, setVerified] = useState(false);

  return (
    <div className={`${playfair.variable} ${inter.variable} ${caveat.variable} ${styles.page}`}>
      <nav className={styles.topNav}>
        <Link href="/" className={styles.logo}>
          <span className={styles.logoBadge}>AI</span>
          Interview Booth
        </Link>
        <Link href="/" className={styles.backHome}>← Back to home</Link>
      </nav>

      <div className={styles.wrap}>
        <span className={styles.heroNote}>can you hear me?</span>

        <div className={styles.card}>
          <div style={{ textAlign: "center" }}>
            <span className={styles.eyebrow}>Mic check</span>
          </div>
          <h1>Let&apos;s test your mic</h1>
          <p className={styles.subtitle}>
            Before you start a voice interview, make sure we can hear you clearly.
            Tap the mic and read the phrase out loud.
          </p>

          <MicCheckCard onVerified={() => setVerified(true)} />

          {!verified && (
            <div className={styles.tips}>
              <p className={styles.tipsLabel}>Tips for a clean check</p>
              <div className={styles.tipsList}>
                {TIPS.map((tip) => (
                  <div key={tip} className={styles.tipRow}>
                    <span className={styles.tipDot}>✓</span>
                    {tip}
                  </div>
                ))}
              </div>
            </div>
          )}

          {verified && (
            <div className={styles.continuePanel}>
              <p className={styles.continueTitle}>You&apos;re all set</p>
              <p className={styles.continueSub}>Your mic is working — ready to start a real practice session.</p>
              <Link href="/practice" className={styles.continueBtn}>
                Start Practicing →
              </Link>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}