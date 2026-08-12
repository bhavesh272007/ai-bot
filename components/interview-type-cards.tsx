// TARGET PATH: components/interview-type-cards.tsx
"use client";

import { INTERVIEW_TYPES, InterviewTypeDef } from "@/lib/interview-types";

interface InterviewTypeCardsProps {
  /** If true, cards become clickable buttons that call onSelect. If false, purely informational. */
  interactive?: boolean;
  selectedId?: string | null;
  onSelect?: (id: string) => void;
}

function CardInner({ type, selected }: { type: InterviewTypeDef; selected: boolean }) {
  return (
    <>
      <div className="flex items-center gap-2 mb-2">
        <span
          className="w-2 h-2 rounded-full shrink-0"
          style={{ backgroundColor: type.accent }}
        />
        <p className="label-mono" style={{ color: type.accent }}>
          {type.ticketCode}
        </p>
      </div>

      <h3 className="font-heading font-bold text-lg mb-2" style={{ color: type.accent }}>
        {type.title}
      </h3>

      <p className="text-sm text-muted-foreground mb-4">{type.description}</p>

      <div className="flex flex-wrap gap-1.5">
        {type.tags.map((tag) => (
          <span
            key={tag}
            className="label-mono rounded-full px-2.5 py-1"
            style={{
              backgroundColor: `${type.accent}1A`,
              color: type.accent,
            }}
          >
            {tag}
          </span>
        ))}
      </div>

      {selected && (
        <p className="label-mono mt-4" style={{ color: type.accent }}>
          ✓ Selected
        </p>
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
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
      {INTERVIEW_TYPES.map((type) => {
        const selected = interactive && selectedId === type.id;
        const cardClass = `text-left rounded-lg border bg-card p-5 transition-all w-full ${
          interactive ? "cursor-pointer hover:shadow-md hover:-translate-y-0.5" : ""
        } ${selected ? "border-2" : "border border-border"}`;
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
