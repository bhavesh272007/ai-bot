// TARGET PATH: app/prep-packs/page.tsx
"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CompanyCards, COMPANIES, type CompanyProfile } from "@/components/company-cards";
import { CheckCircle2, Sparkles, Loader2, AlertCircle } from "lucide-react";

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
    <main className="min-h-screen bg-background px-4 py-12">
      <div className="mx-auto max-w-4xl space-y-8">
        <div className="text-center space-y-2">
          <p className="label-mono text-seal">Company-specific practice</p>
          <h1 className="text-3xl">Prep Packs</h1>
          <p className="text-sm text-muted-foreground max-w-md mx-auto">
            Pick a company to see a practice question set styled after their typical placement
            interview pattern.
          </p>
        </div>

        <CompanyCards mode="select" selectedId={selectedId} onSelect={handleSelect} />

        {loading && (
          <div className="flex items-center justify-center gap-2 text-muted-foreground py-8">
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading prep pack...
          </div>
        )}

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

        {pack && !loading && (
          <Card>
            <CardHeader className="space-y-2">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <CardTitle>{pack.companyLabel} Prep Pack</CardTitle>
                {pack.isCurated ? (
                  <span className="inline-flex items-center gap-1 label-mono text-verified border border-verified/40 rounded px-2 py-1">
                    <CheckCircle2 className="h-3 w-3" /> Curated by our team
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 label-mono text-muted-foreground border border-border rounded px-2 py-1">
                    <Sparkles className="h-3 w-3" /> AI-generated — practice style only
                  </span>
                )}
              </div>
              <p className="text-sm text-muted-foreground">
                {pack.isCurated
                  ? "These questions were entered by our team based on real interview experience — not scraped, and not guaranteed to repeat, but grounded in what candidates have actually reported."
                  : "These are AI-generated questions written in this company's typical interview style — not real or leaked questions. Use them to get a feel for the pattern, not to memorize exact answers."}
              </p>
            </CardHeader>
            <CardContent>
              <div className="divide-y divide-border">
                {pack.questions.map((q, i) => (
                  <div key={i} className="py-4 space-y-1.5 first:pt-0 last:pb-0">
                    <Badge variant="secondary" className="w-fit font-mono text-xs">
                      {q.category}
                    </Badge>
                    <p className="text-sm text-foreground">{q.question}</p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {!selectedId && (
          <p className="text-center label-mono text-muted-foreground/60">
            Pick a company above to see its prep pack.
          </p>
        )}

        <p className="text-sm text-muted-foreground/70 text-center">
          <a href="/" className="hover:underline">
            ← Back to home
          </a>
        </p>
      </div>
    </main>
  );
}