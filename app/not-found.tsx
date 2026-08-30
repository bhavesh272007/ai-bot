// TARGET PATH: app/not-found.tsx
import Link from "next/link";
import { SearchX } from "lucide-react";
import styles from "./not-found.module.css";

export default function NotFound() {
  return (
    <div className={styles.page}>
      <nav className={styles.topNav}>
        <Link href="/" className={styles.logo}>
          <span className={styles.logoBadge}>AI</span>
          Interview Booth
        </Link>
      </nav>

      <div className={styles.wrap}>
        <span className={styles.heroNote}>wrong turn!</span>

        <div className={styles.card}>
          <div className={styles.badge}>
            <span>404</span>
          </div>

          <span className={styles.eyebrow}>Page not found</span>
          <h1>This page took a wrong turn</h1>
          <p className={styles.subtitle}>
            There&apos;s no page, interview, or link at this address. It may have
            been moved, expired, or never existed.
          </p>

          <div className={styles.actions}>
            <Link href="/" className={styles.btnOutline}>← Back to Home</Link>
            <Link href="/practice" className={styles.btnSolid}>Start Practicing</Link>
          </div>

          <p className={styles.footNote}>
            <SearchX size={12} />
            Error 404 · Not found
          </p>
        </div>
      </div>
    </div>
  );
}