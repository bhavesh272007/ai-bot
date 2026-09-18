// TARGET PATH: app/practice/page.tsx
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Loader2, AlertCircle } from "lucide-react";
import { InterviewTypeCards } from "@/components/interview-type-cards";
import { DomainCards, type Domain } from "@/components/domain-cards";
import { ResumeUpload } from "@/components/resume-upload";
import { INTERVIEWER_PERSONALITIES } from "@/lib/interviewer-personalities";
import styles from "./page.module.css";

const LEVELS = ["Internship", "Entry-level", "Experienced"] as const;

// Cosmetic-only accent per personality card — cycles through the same three
// tones the landing page uses for Strict / Friendly / Rapid-Fire, matched by
// keyword where possible so new personalities still get a sensible color.
const PERSONALITY_PALETTE = [
  { border: "rgba(166, 61, 64, 0.35)", borderHover: "#a63d40", wash: "rgba(166, 61, 64, 0.06)", dot: "#a63d40" },
  { border: "rgba(47, 110, 81, 0.35)", borderHover: "#2f6e51", wash: "rgba(47, 110, 81, 0.06)", dot: "#2f6e51" },
  { border: "rgba(200, 155, 60, 0.45)", borderHover: "#c89b3c", wash: "rgba(200, 155, 60, 0.08)", dot: "#c89b3c" },
];
function personalityAccent(id: string, index: number) {
  const key = id.toLowerCase();
  if (key.includes("strict")) return PERSONALITY_PALETTE[0];
  if (key.includes("friendly")) return PERSONALITY_PALETTE[1];
  if (key.includes("rapid")) return PERSONALITY_PALETTE[2];
  return PERSONALITY_PALETTE[index % PERSONALITY_PALETTE.length];
}

export default function Practice() {
  const router = useRouter();

  const [interviewType, setInterviewType] = useState<string | null>(null);
  const [selectedDomainId, setSelectedDomainId] = useState<string | null>(null);
  const [role, setRole] = useState("");
  const [company, setCompany] = useState("");
  const [level, setLevel] = useState<(typeof LEVELS)[number]>("Entry-level");
  // Defaults to Friendly HR — same "sensible default, no forced choice" pattern
  // as Experience Level above. Candidate can change it before starting.
  const [interviewerPersonality, setInterviewerPersonality] = useState<string>("friendly_hr");
  // Opt-in only — off by default. Two AI interviewers (technical +
  // behavioral) alternate questions instead of one. Practice mode only.
  const [panelMode, setPanelMode] = useState(false);
  const [resumeText, setResumeText] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const canStart = !loading && role.trim().length >= 2 && !!interviewType;

  function handleDomainSelect(domain: Domain) {
    setSelectedDomainId(domain.id);
    // Quick-fill only — the existing role input is what actually reaches
    // generate-practice-questions, so this can't silently do nothing if
    // that route doesn't separately handle a "domain" field. User can still
    // edit the role text after picking a domain.
    setRole(domain.label);
  }

  async function handleStart() {
    if (!interviewType) {
      setError("Pick an interview type above to continue.");
      return;
    }

    setLoading(true);
    setError("");

    try {
      const res = await fetch("/api/generate-practice-questions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          role,
          company,
          level,
          interviewType,
          resumeText,
          interviewerPersonality,
          panelMode,
        }),
      });

      const data = await res.json().catch(() => null);

      if (!res.ok) {
        setError(data?.error || `Server error (${res.status}). Please try again.`);
        setLoading(false);
        return;
      }

      if (!data?.interviewId) {
        setError("Invalid response received from server.");
        setLoading(false);
        return;
      }

      router.push(`/interview/${data.interviewId}`);
    } catch (err) {
      console.error("Practice start error:", err);
      setError("Failed to reach the server. Please check your connection and try again.");
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

      <div className={styles.wrap}>
        <div className={styles.card}>
          <span className={styles.eyebrow}>Self practice · no login needed</span>
          <h1>Build your own mock interview</h1>
          <p className={styles.intro}>
            Tell us what you&apos;re preparing for. We&apos;ll generate a full practice
            interview — question round, live coding, and voice practice — scored
            just like the real thing. Nothing here is tracked by any recruiter.
          </p>

          <div className={styles.section}>
            <p className={styles.sectionLabel}>Choose interview type</p>
            <InterviewTypeCards
              interactive
              selectedId={interviewType}
              onSelect={setInterviewType}
            />
          </div>

          <div className={styles.section}>
            <p className={styles.sectionLabel}>Choose your domain</p>
            <p className={styles.sectionHint}>
              Picks a starting point for your target role below — feel free to edit it after.
            </p>
            <DomainCards
              mode="select"
              selectedId={selectedDomainId}
              onSelect={handleDomainSelect}
            />
          </div>

          <div className={styles.section}>
            <div className={styles.fieldGrid}>
              <div className={styles.field}>
                <label className={styles.fieldLabel}>Target role</label>
                <input
                  value={role}
                  onChange={(e) => setRole(e.target.value)}
                  placeholder="e.g. Software Engineer, Data Analyst"
                  className={styles.input}
                />
              </div>
              <div className={styles.field}>
                <label className={styles.fieldLabel}>Target company (optional)</label>
                <input
                  value={company}
                  onChange={(e) => setCompany(e.target.value)}
                  placeholder="e.g. TCS, Infosys, or leave blank"
                  className={styles.input}
                />
              </div>
            </div>
          </div>

          <div className={styles.section}>
            <p className={styles.sectionLabel}>Experience level</p>
            <div className={styles.levelGroup}>
              {LEVELS.map((l) => (
                <button
                  key={l}
                  type="button"
                  onClick={() => setLevel(l)}
                  className={`${styles.levelBtn} ${level === l ? styles.levelBtnActive : ""}`}
                >
                  {l}
                </button>
              ))}
            </div>
          </div>

          <div className={styles.section}>
            <p className={styles.sectionLabel}>Interviewer personality</p>
            <p className={styles.sectionHint}>
              Shapes the tone of follow-up questions and how strictly your answers are scored.
            </p>
            <div className={styles.personalityGrid}>
              {INTERVIEWER_PERSONALITIES.map((p, i) => {
                const accent = personalityAccent(p.id, i);
                const selected = interviewerPersonality === p.id;
                return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => setInterviewerPersonality(p.id)}
                    className={styles.personalityCard}
                    style={{
                      borderColor: selected ? accent.borderHover : accent.border,
                      background: selected ? accent.wash : "#fafafa",
                    }}
                  >
                    <p className={styles.personalityTitle}>
                      <span className={styles.personalityDot} style={{ background: accent.dot }} />
                      {p.title}
                    </p>
                    <p className={styles.personalityDesc}>{p.description}</p>
                    {selected && (
                      <span className={styles.personalitySelected} style={{ color: accent.borderHover }}>
                        ✓ Selected
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          <div className={styles.section}>
            <div className={styles.toggleRow}>
              <span className={styles.toggleSwitch}>
                <input
                  type="checkbox"
                  checked={panelMode}
                  onChange={(e) => setPanelMode(e.target.checked)}
                  id="panelMode"
                />
                <span className={styles.toggleTrack} />
              </span>
              <div className={styles.toggleCopy}>
                <label htmlFor="panelMode" className={styles.toggleTitle}>
                  Panel interview (2 interviewers)
                </label>
                <p className={styles.toggleDesc}>
                  A technical and a behavioral interviewer alternate questions in the same session,
                  instead of one interviewer asking everything.
                  {panelMode && (
                    <span className={styles.toggleNote}>
                      Note: the question mix will be balanced across categories while this is on, so
                      both interviewers get a turn — your Interview Type selection above won&apos;t skew it.
                    </span>
                  )}
                </p>
              </div>
            </div>
          </div>

          <div className={styles.section}>
            <ResumeUpload
              onExtracted={(text) => setResumeText(text)}
              onClear={() => setResumeText(null)}
            />
          </div>

          <button
            type="button"
            onClick={handleStart}
            disabled={!canStart}
            className={styles.submitBtn}
          >
            {loading && <Loader2 size={16} className={styles.spinner} />}
            {loading ? "Building your interview…" : "Start Practice Interview"}
          </button>

          {!interviewType && !error && (
            <p className={styles.helperText}>Pick an interview type above to enable this button.</p>
          )}

          {error && (
            <p className={styles.errorMsg}>
              <AlertCircle size={14} />
              {error}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}