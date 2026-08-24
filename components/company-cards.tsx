// TARGET PATH: components/company-cards.tsx
"use client";

import { CheckCircle2 } from "lucide-react";
import { COMPANIES, type CompanyProfile } from "@/lib/companies";

// Re-exported for backward compatibility with pages that already import
// COMPANIES/CompanyProfile from this file — the actual data now lives in
// lib/companies.ts (a plain, non-client module) so server-side Route
// Handlers can import it safely too. See lib/companies.ts for why.
export { COMPANIES, type CompanyProfile };

interface CompanyCardsProps {
  mode: "showcase" | "select";
  selectedId?: string | null;
  onSelect?: (company: CompanyProfile) => void;
}

// Mirrors DomainCards exactly: "showcase" for informational/hover-only
// grids, "select" for real interactive buttons with a highlighted state.
export function CompanyCards({ mode, selectedId, onSelect }: CompanyCardsProps) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      {COMPANIES.map((company) => {
        const Icon = company.icon;
        const isSelected = mode === "select" && selectedId === company.id;

        const cardContent = (
          <>
            {isSelected && (
              <span className="absolute top-3 right-3 text-accent-foreground">
                <CheckCircle2 className="h-4 w-4" />
              </span>
            )}
            <div
              className={`w-11 h-11 rounded-xl border flex items-center justify-center mb-3 transition-colors ${
                isSelected
                  ? "border-transparent bg-accent text-accent-foreground"
                  : "border-border bg-muted text-muted-foreground group-hover:border-foreground/20 group-hover:bg-accent/60 group-hover:text-accent-foreground"
              }`}
            >
              <Icon className="h-5 w-5" />
            </div>
            <p className="font-heading font-semibold text-sm text-foreground">
              {company.label}
            </p>
            <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
              {company.description}
            </p>
          </>
        );

        const baseClasses =
          "group relative flex flex-col items-start rounded-2xl border p-4 text-left transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[0_14px_28px_-16px_rgba(0,0,0,0.16)]";

        if (mode === "showcase") {
          return (
            <div key={company.id} className={`${baseClasses} border-border hover:border-foreground/20`}>
              {cardContent}
            </div>
          );
        }

        return (
          <button
            key={company.id}
            type="button"
            onClick={() => onSelect?.(company)}
            className={`${baseClasses} ${
              isSelected ? "border-foreground bg-accent/30" : "border-border hover:border-foreground/20"
            }`}
          >
            {cardContent}
          </button>
        );
      })}
    </div>
  );
}