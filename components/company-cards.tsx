// TARGET PATH: components/company-cards.tsx
"use client";

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
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
      {COMPANIES.map((company) => {
        const Icon = company.icon;
        const isSelected = mode === "select" && selectedId === company.id;

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
                {company.label}
              </p>
              <p className="text-xs text-muted-foreground truncate">{company.description}</p>
            </div>
          </>
        );

        const baseClasses =
          "flex items-center gap-3 rounded-lg border px-3.5 py-3 transition-colors";

        if (mode === "showcase") {
          return (
            <div
              key={company.id}
              className={`${baseClasses} border-border hover:border-foreground/30 hover:bg-muted/40`}
            >
              {cardContent}
            </div>
          );
        }

        return (
          <button
            key={company.id}
            type="button"
            onClick={() => onSelect?.(company)}
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