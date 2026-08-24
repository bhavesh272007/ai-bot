// TARGET PATH: components/interview-type-cards.tsx
"use client";

import { INTERVIEW_TYPES, InterviewTypeDef } from "@/lib/interview-types";
import styles from "./interview-type-cards.module.css";

interface InterviewTypeCardsProps {
  /** If true, cards become clickable buttons that call onSelect. If false, purely informational. */
  interactive?: boolean;
  selectedId?: string | null;
  onSelect?: (id: string) => void;
}

function CardInner({ type, selected }: { type: InterviewTypeDef; selected: boolean }) {
  return (
    <>
      <div className={styles.codeRow}>
        <span className={styles.codeDot} style={{ backgroundColor: type.accent }} />
        <p className={styles.codeText} style={{ color: type.accent }}>
          {type.ticketCode}
        </p>
      </div>

      <h3 className={styles.title} style={{ color: type.accent }}>
        {type.title}
      </h3>

      <p className={styles.desc}>{type.description}</p>

      <div className={styles.tags}>
        {type.tags.map((tag) => (
          <span
            key={tag}
            className={styles.tag}
            style={{
              backgroundColor: `color-mix(in srgb, ${type.accent} 16%, transparent)`,
              color: type.accent,
            }}
          >
            {tag}
          </span>
        ))}
      </div>

      {selected && (
        <span className={styles.selected} style={{ color: type.accent }}>
          ✓ Selected
        </span>
      )}
    </>
  );
}

export function InterviewTypeCards({
  interactive = false,
  selectedId = null,
  onSelect,
}: InterviewTypeCardsProps) {
  return (
    <div className={styles.grid}>
      {INTERVIEW_TYPES.map((type) => {
        const selected = interactive && selectedId === type.id;
        const cardClass = `${styles.card} ${interactive ? styles.cardInteractive : ""} ${
          selected ? styles.cardSelected : ""
        }`;
        const cardStyle = selected ? { borderColor: type.accent } : undefined;

        if (interactive) {
          return (
            <button
              key={type.id}
              type="button"
              onClick={() => onSelect?.(type.id)}
              className={cardClass}
              style={cardStyle}
            >
              <CardInner type={type} selected={selected} />
            </button>
          );
        }

        return (
          <div key={type.id} className={cardClass} style={cardStyle}>
            <CardInner type={type} selected={selected} />
          </div>
        );
      })}
    </div>
  );
}