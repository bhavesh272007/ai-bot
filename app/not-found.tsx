// TARGET PATH: app/not-found.tsx
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { SearchX } from "lucide-react";

export default function NotFound() {
  return (
    <main
      className="min-h-screen flex items-center justify-center px-4"
      style={{
        backgroundImage: "radial-gradient(#E4E1D5 1px, transparent 1px)",
        backgroundSize: "16px 16px",
      }}
    >
      <Card className="max-w-md w-full overflow-hidden pt-0 relative">
        <div className="flex gap-1.5 px-6 pt-4 pb-2">
          {Array.from({ length: 8 }).map((_, i) => (
            <div
              key={i}
              className="w-1.5 h-1.5 rounded-full bg-background border border-border"
            />
          ))}
        </div>

        <CardHeader>
          <p className="label-mono mb-1">Record not found</p>
          <CardTitle className="text-xl">This roll number doesn&apos;t exist</CardTitle>
        </CardHeader>

        <CardContent className="space-y-5 text-center">
          <div
            className="w-24 h-24 mx-auto flex items-center justify-center relative"
            style={{
              background: "#A63D40",
              borderRadius: "42% 58% 63% 37% / 41% 44% 56% 59%",
              transform: "rotate(-8deg)",
            }}
          >
            <span
              className="font-mono text-2xl font-bold text-background"
              style={{ transform: "rotate(8deg)" }}
            >
              404
            </span>
          </div>

          <p className="text-sm text-muted-foreground max-w-xs mx-auto">
            We checked the ledger twice — there&apos;s no page, interview, or
            candidate record at this link. It may have been moved, expired, or
            never existed.
          </p>

          <div className="flex flex-col sm:flex-row gap-3 pt-1">
            <Button asChild variant="outline" className="flex-1">
              <a href="/">← Back to Home</a>
            </Button>
            <Button asChild className="flex-1">
              <a href="/practice">Start Practicing</a>
            </Button>
          </div>

          <div className="flex justify-center gap-0.5 pt-3 opacity-40">
            {[2, 1, 3, 1, 2, 1, 1, 3, 2, 1, 2, 1, 3, 1, 2].map((w, i) => (
              <div
                key={i}
                style={{ width: `${w}px`, height: "16px" }}
                className="bg-foreground"
              />
            ))}
          </div>
          <p className="label-mono text-muted-foreground/60 flex items-center justify-center gap-1.5">
            <SearchX className="h-3 w-3" />
            BOOTH-2026-VOID
          </p>
        </CardContent>
      </Card>
    </main>
  );
}