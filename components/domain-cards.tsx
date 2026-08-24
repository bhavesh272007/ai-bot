// TARGET PATH: components/domain-cards.tsx
"use client";

import {
  Code2,
  Network,
  BarChart3,
  Brain,
  Package,
  Cloud,
  Globe,
  Database,
  ShieldCheck,
  type LucideIcon,
} from "lucide-react";
import styles from "./domain-cards.module.css";

export interface Domain {
  id: string;
  label: string;
  description: string;
  icon: LucideIcon;
}

// Single source of truth for the domain list — landing page showcase and
// practice page selector both read from this so they can't drift apart.
export const DOMAINS: Domain[] = [
  { id: "software-engineering", label: "Software Engineering", description: "DSA, coding & problem solving", icon: Code2 },
  { id: "system-design", label: "System Design", description: "Scalable systems & architecture", icon: Network },
  { id: "data-analytics", label: "Data Analytics", description: "SQL, metrics & dashboards", icon: BarChart3 },
  { id: "data-science-ml", label: "Data Science & ML", description: "Stats, ML models & case studies", icon: Brain },
  { id: "product-management", label: "Product Management", description: "Product sense & strategy rounds", icon: Package },
  { id: "cloud-devops", label: "Cloud & DevOps", description: "AWS, CI/CD & infrastructure", icon: Cloud },
  { id: "fullstack-development", label: "FullStack Development", description: "Frontend, APIs & deployment", icon: Globe },
  { id: "data-engineering", label: "Data Engineering", description: "ETL, Spark & pipeline internals", icon: Database },
  { id: "qa-test-engineering", label: "QA & Test Engineering", description: "Automation & test strategy", icon: ShieldCheck },
];

interface DomainCardsProps {
  mode: "showcase" | "select";
  selectedId?: string | null;
  onSelect?: (domain: Domain) => void;
}

// mode="showcase": informational grid, not interactive — matches the
// existing InterviewTypeCards pattern on the landing page (hover only,
// no click target).
// mode="select": real buttons, highlights the selected domain, calls
// onSelect — used on the practice page.
export function DomainCards({ mode, selectedId, onSelect }: DomainCardsProps) {
  return (
    <div className={styles.grid}>
      {DOMAINS.map((domain) => {
        const Icon = domain.icon;
        const isSelected = mode === "select" && selectedId === domain.id;

        const cardContent = (
          <>
            <div className={`${styles.iconWrap} ${isSelected ? styles.iconWrapSelected : ""}`}>
              <Icon size={16} strokeWidth={1.75} />
            </div>
            <div className={styles.text}>
              <p className={styles.label}>{domain.label}</p>
              <p className={styles.desc}>{domain.description}</p>
            </div>
          </>
        );

        const cardClass = `${styles.card} ${mode === "select" ? styles.cardInteractive : ""} ${
          isSelected ? styles.cardSelected : ""
        }`;

        if (mode === "showcase") {
          return (
            <div key={domain.id} className={cardClass}>
              {cardContent}
            </div>
          );
        }

        return (
          <button
            key={domain.id}
            type="button"
            onClick={() => onSelect?.(domain)}
            className={cardClass}
          >
            {cardContent}
          </button>
        );
      })}
    </div>
  );
}