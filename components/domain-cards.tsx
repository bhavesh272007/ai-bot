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
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
      {DOMAINS.map((domain) => {
        const Icon = domain.icon;
        const isSelected = mode === "select" && selectedId === domain.id;

        const cardContent = (
          <>
            <div
              className={`shrink-0 w-9 h-9 rounded-full border flex items-center justify-center transition-colors ${
                isSelected ? "border-seal bg-seal/10 text-seal" : "border-border text-muted-foreground"
              }`}
            >
              <Icon className="h-4 w-4" />
            </div>
            <div className="min-w-0 text-left">
              <p className="font-heading font-medium text-sm text-foreground truncate">
                {domain.label}
              </p>
              <p className="text-xs text-muted-foreground truncate">{domain.description}</p>
            </div>
          </>
        );

        const baseClasses =
          "flex items-center gap-3 rounded-lg border px-3.5 py-3 transition-colors";

        if (mode === "showcase") {
          return (
            <div
              key={domain.id}
              className={`${baseClasses} border-border hover:border-foreground/30 hover:bg-muted/40`}
            >
              {cardContent}
            </div>
          );
        }

        return (
          <button
            key={domain.id}
            type="button"
            onClick={() => onSelect?.(domain)}
            className={`${baseClasses} text-left ${
              isSelected
                ? "border-seal bg-seal/5 ring-1 ring-seal"
                : "border-border hover:border-foreground/30 hover:bg-muted/40"
            }`}
          >
            {cardContent}
          </button>
        );
      })}
    </div>
  );
}