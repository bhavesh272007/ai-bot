// TARGET PATH: app/prep-packs/page.tsx
"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CompanyCards, COMPANIES, type CompanyProfile } from "@/components/company-cards";
import { CheckCircle2, Sparkles, Loader2, AlertCircle, ArrowLeft } from "lucide-react";

interface PackQuestion {
  category: string;
  question: string;
}

interface PackResult {
  companyId: string;
  companyLabel: string;
  questions: PackQuestion[];
  isCurated: boolean;
}

export default function PrepPacks() {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [pack, setPack] = useState<PackResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSelect(company: CompanyProfile) {
    setSelectedId(company.id);
    setPack(null);
    setLoading(true);
    setError("");

    try {
      const res = await fetch(`/api/prep-pack/${company.id}`);
      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Couldn't load this prep pack.");
        return;
      }

      setPack(data);
    } catch {
      setError("Failed to reach the server.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen bg-background px-4 py-16">
      <div className="mx-auto max-w-4xl space-y-10">
        {/* ---------- HERO ---------- */}
        <div className="text-center space-y-3">
          <p className="label-mono text-seal">Company-specific practice</p>
          <h1 className="text-4xl font-heading font-semibold text-foreground">Prep Packs</h1>
          <p className="text-sm text-muted-foreground max-w-md mx-auto leading-relaxed">
            Pick a company to see a practice question set styled after their typical placement
            interview pattern.
          </p>
        </div>

        {/* ---------- PICKER ---------- */}
        <CompanyCards mode="select" selectedId={selectedId} onSelect={handleSelect} />

        {/* ---------- LOADING ---------- */}
        {loading && (
          <div className="flex items-center justify-center gap-3 py-10">
            <span className="flex h-9 w-9 items-center justify-center rounded-full bg-accent text-accent-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
            </span>
            <p className="text-sm text-muted-foreground">Loading prep pack...</p>
          </div>
        )}

        {/* ---------- ERROR ---------- */}
        {error && (
          <Card>
            <CardContent className="py-6 text-center">
              <p className="flex items-center justify-center gap-1.5 text-sm text-destructive">
                <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                {error}
              </p>
            </CardContent>
          </Card>
        )}

        {/* ---------- RESULT ---------- */}
        {pack && !loading && (
          <Card className="overflow-hidden">
            <CardHeader className="space-y-3">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <CardTitle className="text-lg font-heading">{pack.companyLabel} Prep Pack</CardTitle>
                {pack.isCurated ? (
                  <Badge variant="outline" className="gap-1.5 border-verified/40 text-verified">
                    <CheckCircle2 className="h-3 w-3" />
                    Curated by our team
                  </Badge>
                ) : (
                  <Badge variant="outline" className="gap-1.5 text-muted-foreground">
                    <Sparkles className="h-3 w-3" />
                    AI-generated — practice style only
                  </Badge>
                )}
              </div>
              <p className="text-sm text-muted-foreground leading-relaxed">
                {pack.isCurated
                  ? "These questions were entered by our team based on real interview experience — not scraped, and not guaranteed to repeat, but grounded in what candidates have actually reported."
                  : "These are AI-generated questions written in this company's typical interview style — not real or leaked questions. Use them to get a feel for the pattern, not to memorize exact answers."}
              </p>
            </CardHeader>
            <CardContent>
              <div className="flex flex-col gap-1">
                {pack.questions.map((q, i) => (
                  <div
                    key={i}
                    className="flex flex-col gap-1.5 rounded-xl px-3 py-3 transition-colors hover:bg-muted/60"
                  >
                    <Badge variant="secondary" className="w-fit font-mono text-[0.65rem]">
                      {q.category}
                    </Badge>
                    <p className="text-sm text-foreground leading-relaxed">{q.question}</p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* ---------- EMPTY STATE ---------- */}
        {!selectedId && (
          <p className="text-center label-mono text-muted-foreground/70">
            Pick a company above to see its prep pack.
          </p>
        )}

        {/* ---------- BACK LINK ---------- */}
        <div className="text-center">
          <a
            href="/"
            className="inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Back to home
          </a>
        </div>
      </div>
    </main>
  );
}