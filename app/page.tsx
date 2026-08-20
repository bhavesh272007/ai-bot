// TARGET PATH: app/page.tsx
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { InterviewTypeCards } from "@/components/interview-type-cards";
import { DomainCards } from "@/components/domain-cards";
import { ThemeToggle } from "@/components/theme-toggle";
import { ChevronDown } from "lucide-react";
import { INTERVIEWER_PERSONALITIES } from "@/lib/interviewer-personalities";
import { CompanyCards, COMPANIES } from "@/components/company-cards";

const FAQS: { question: string; answer: string }[] = [
  {
    question: "Do I need to create an account to practice?",
    answer:
      "No. Self-practice mode is completely open — pick a role and go. Accounts only exist for recruiters who want to generate and track interviews for real candidates.",
  },
  {
    question: "Will a recruiter ever see my practice results?",
    answer:
      "No. Practice sessions started from this site are never linked to any recruiter or dashboard. They exist only for you, to help you prepare.",
  },
  {
    question: "What does a full interview actually cover?",
    answer:
      "Every interview has two rounds: a question-and-answer round covering CS fundamentals, DSA, your experience, and behavioral questions, followed by a live coding round with real test cases — both scored by AI.",
  },
  {
    question: "Can I choose what kind of interview to practice?",
    answer:
      "Yes. On the practice page you can pick a focus — Behavioral, Technical, HR & Situational, or Industry-Specific — and the questions generated will be weighted toward that style.",
  },
  {
    question: "How are my answers actually scored?",
    answer:
      "An AI model reads each answer and scores it out of 10 on correctness, clarity, and depth, with specific feedback on strengths and what to improve — the same way for the coding round, based on test results and code quality.",
  },
  {
    question: "What programming languages does the coding round support?",
    answer:
      "JavaScript, Python, Java, and C++. You can switch languages before submitting, and your code runs against real test cases before it's scored.",
  },
  {
    question: "Can I keep a copy of my results?",
    answer:
      "Yes. After finishing the coding round you can download a PDF report with your full Q&A breakdown and coding score to keep for your own tracking.",
  },
  {
    question: "How does the recruiter side work?",
    answer:
      "A recruiter pastes a job description, AI generates tailored questions, and they get a shareable link. Candidates open the link and answer directly — no account needed on the candidate's end.",
  },
];

// Color-codes each personality using tokens already in the design system
// (verified / seal / destructive) rather than introducing new hex values —
// keeps this section clean of hardcoded colors ahead of the Grind Mode
// token migration.
const PERSONALITY_ACCENT: Record<string, { border: string; text: string; dot: string }> = {
  strict_panel: { border: "border-destructive/40", text: "text-destructive", dot: "bg-destructive" },
  friendly_hr: { border: "border-verified/40", text: "text-verified", dot: "bg-verified" },
  rapid_fire_technical: { border: "border-seal/40", text: "text-seal", dot: "bg-seal" },
};

export default function Landing() {
  return (
    <main
      className="min-h-screen px-4 py-4 sm:py-10"
      style={{
        backgroundImage: "radial-gradient(var(--border) 1px, transparent 1px)",
        backgroundSize: "16px 16px",
      }}
    >
      <div className="mx-auto max-w-2xl w-full bg-background border border-border rounded-xl overflow-hidden">
        {/* Tear-away punch holes */}
        <div className="flex gap-1.5 px-6 pt-1.5">
          {Array.from({ length: 8 }).map((_, i) => (
            <div
              key={i}
              className="w-2 h-2 rounded-full bg-background border border-border"
            />
          ))}
        </div>

        {/* Top bar */}
        <div className="flex items-center justify-between px-6 py-2.5 border-b border-border">
          <span className="font-heading font-bold text-base text-foreground">
            AI interview practice booth
          </span>
          <div className="flex items-center gap-3">
            <ThemeToggle />
            <a href="/login">
              <span className="label-mono border border-border rounded px-3 py-1.5">
                Recruiter login
              </span>
            </a>
          </div>
        </div>

        {/* Hero */}
        <div className="relative px-6 pt-4 pb-3.5 text-center">
          <p className="label-mono text-seal mb-2">For engineering placements</p>
          <h1 className="text-xl sm:text-4xl leading-tight mb-1.5">
            Practice interviews.
            <br />
            <span className="relative inline-block">
              Get placed.
              <svg
                width="150"
                height="16"
                viewBox="0 0 150 16"
                className="absolute left-0 -bottom-1.5"
              >
                <path
                  d="M2 9 C 30 3, 60 13, 90 6 S 130 10, 148 5"
                  stroke="var(--destructive)"
                  strokeWidth="2.5"
                  fill="none"
                  strokeLinecap="round"
                />
              </svg>
            </span>
          </h1>
          <p className="text-sm text-muted-foreground max-w-sm mx-auto">
            AI-generated questions, live coding rounds, and voice practice —
            scored like the real thing.
          </p>

          <span
            className="hidden sm:block absolute top-3 right-2 text-xl text-destructive"
            style={{ fontFamily: "var(--font-hand)", transform: "rotate(8deg)" }}
          >
            good luck!
          </span>
        </div>

        {/* Ticket: candidate / recruiter stubs */}
        <div className="px-6 pb-2">
          <div className="grid grid-cols-[1fr_auto_1fr] bg-card border border-border rounded-lg overflow-hidden">
            <div className="p-4">
              <p className="label-mono mb-1.5">Candidate stub</p>
              <p className="font-heading font-medium text-sm text-foreground mb-1">
                Have a link?
              </p>
              <p className="text-sm text-muted-foreground mb-2">
                Open it directly. No account needed.
              </p>
              <Button asChild size="sm" variant="outline">
                <a href="/practice">Practice without a link →</a>
              </Button>
              <div>
                <a
                  href="/candidate/dashboard"
                  className="label-mono text-muted-foreground hover:text-foreground transition-colors inline-block mt-2"
                >
                  Track your progress →
                </a>
              </div>
            </div>

            <div className="ticket-divider relative">
              <div className="absolute -top-2 -left-2 w-4 h-4 rounded-full bg-background border border-border" />
              <div className="absolute -bottom-2 -left-2 w-4 h-4 rounded-full bg-background border border-border" />
            </div>

            <div className="p-4 relative">
              <p className="label-mono mb-1.5">Recruiter stub</p>
              <p className="font-heading font-medium text-sm text-foreground mb-1">
                Creating interviews?
              </p>
              <p className="text-sm text-muted-foreground mb-2">
                Log in to generate and track candidates.
              </p>
              <Button asChild size="sm">
                <a href="/login">Recruiter login</a>
              </Button>

              <div className="absolute top-3 right-2 w-14 h-14">
                <div className="seal-badge w-14 h-14 flex items-center justify-center">
                  <span
                    className="font-mono text-xs font-medium text-center leading-tight"
                    style={{ color: "#412402", transform: "rotate(-8deg)" }}
                  >
                    8.5
                    <br />
                    <span className="text-[8px]">/10</span>
                  </span>
                </div>
                <svg
                  width="70"
                  height="70"
                  viewBox="0 0 70 70"
                  className="absolute -top-1.5 -left-1.5 pointer-events-none"
                >
                  <path
                    d="M14 40 C 12 25, 25 10, 40 12"
                    stroke="var(--destructive)"
                    strokeWidth="2"
                    fill="none"
                    strokeLinecap="round"
                    opacity="0.85"
                  />
                  <path
                    d="M40 12 L 46 15 M40 12 L 38 19"
                    stroke="var(--destructive)"
                    strokeWidth="2"
                    fill="none"
                    strokeLinecap="round"
                    opacity="0.85"
                  />
                </svg>
              </div>
            </div>
          </div>

          {/* Barcode footer */}
          <div className="flex justify-center gap-0.5 pt-3 pb-1 opacity-50">
            {[2, 1, 3, 1, 2, 1, 1, 3, 2, 1, 2, 1, 3, 1, 2].map((w, i) => (
              <div
                key={i}
                style={{ width: `${w}px`, height: "18px" }}
                className="bg-foreground"
              />
            ))}
          </div>
          <p className="text-center label-mono text-muted-foreground/60 mb-3">
            BOOTH-2026-AIIP
          </p>
        </div>
      </div>

      {/* Interview types showcase — informational only, not clickable */}
      <div
        id="what-we-cover"
        className="mx-auto max-w-4xl w-full bg-background border border-border rounded-xl overflow-hidden mt-8 scroll-mt-24"
      >
        <div className="flex gap-1.5 px-6 pt-2">
          {Array.from({ length: 14 }).map((_, i) => (
            <div
              key={i}
              className="w-2 h-2 rounded-full bg-background border border-border"
            />
          ))}
        </div>

        <div className="px-6 pt-6 pb-2 text-center">
          <p className="label-mono text-seal mb-2">What we cover</p>
          <h2 className="text-2xl sm:text-3xl leading-tight mb-2">
            Types of mock interview practice
          </h2>
          <p className="text-sm text-muted-foreground max-w-md mx-auto">
            Whether you're a fresher preparing for campus placements or targeting
            a specific company, our AI covers every interview format.
          </p>
        </div>

        <div className="px-6 pt-6 pb-8">
          <InterviewTypeCards />
        </div>
      </div>

      {/* Domain showcase — informational only, actual selection happens on /practice */}
      <div className="mx-auto max-w-4xl w-full bg-background border border-border rounded-xl overflow-hidden mt-8">
        <div className="flex gap-1.5 px-6 pt-2">
          {Array.from({ length: 14 }).map((_, i) => (
            <div
              key={i}
              className="w-2 h-2 rounded-full bg-background border border-border"
            />
          ))}
        </div>

        <div className="px-6 pt-6 pb-2 text-center">
          <p className="label-mono text-seal mb-2">Pick your track</p>
          <h2 className="text-2xl sm:text-3xl leading-tight mb-2">
            Practice interviews by domain
          </h2>
          <p className="text-sm text-muted-foreground max-w-md mx-auto">
            From core software roles to specialized tracks — choose your domain
            when you start practicing.
          </p>
        </div>

        <div className="px-6 pt-6 pb-8">
          <DomainCards mode="showcase" />
          <div className="text-center mt-5">
            <Button asChild size="sm" variant="outline">
              <a href="/practice">Choose your domain →</a>
            </Button>
          </div>
        </div>
      </div>

      {/* Interviewer personality showcase — informational only, actual
          selection happens on /practice. Highlighted with a rotated
          seal-style "NEW" stamp, same visual language as the hero's
          score stamp, since this is the newest feature on the site. */}
      <div className="mx-auto max-w-4xl w-full bg-background border border-border rounded-xl overflow-hidden mt-8">
        <div className="flex gap-1.5 px-6 pt-2">
          {Array.from({ length: 14 }).map((_, i) => (
            <div
              key={i}
              className="w-2 h-2 rounded-full bg-background border border-border"
            />
          ))}
        </div>

        <div className="relative px-6 pt-6 pb-2 text-center">
          <p className="label-mono text-seal mb-2">Set the tone</p>
          <h2 className="text-2xl sm:text-3xl leading-tight mb-2">
            Choose your interviewer's personality
          </h2>
          <p className="text-sm text-muted-foreground max-w-md mx-auto">
            The same questions, three different examiners — pick who grills you
            before you start.
          </p>

          {/* Rotated seal stamp, matching the hero's score-stamp motif */}
          <div className="hidden sm:block absolute top-4 right-6 w-16 h-16">
            <div className="seal-badge w-16 h-16 flex items-center justify-center">
              <span
                className="font-mono text-[11px] font-bold text-center leading-tight"
                style={{ color: "#412402", transform: "rotate(-8deg)" }}
              >
                NEW
              </span>
            </div>
          </div>
        </div>

        <div className="px-6 pt-6 pb-8">
          <div className="grid sm:grid-cols-3 gap-3">
            {INTERVIEWER_PERSONALITIES.map((p) => {
              const accent = PERSONALITY_ACCENT[p.id] ?? {
                border: "border-border",
                text: "text-foreground",
                dot: "bg-foreground",
              };
              return (
                <Card key={p.id} className={`${accent.border} transition-colors`}>
                  <CardHeader>
                    <div className="flex items-center gap-2">
                      <span className={`w-2 h-2 rounded-full shrink-0 ${accent.dot}`} />
                      <CardTitle className={`text-base ${accent.text}`}>{p.title}</CardTitle>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-muted-foreground">{p.description}</p>
                  </CardContent>
                </Card>
              );
            })}
          </div>
          <div className="text-center mt-5">
            <Button asChild size="sm" variant="outline">
              <a href="/practice">Pick your interviewer →</a>
            </Button>
          </div>
        </div>
      </div>

      {/* Prep packs showcase — informational only, actual browsing happens
          on /prep-packs. Shows all COMPANIES, same "full list in showcase
          mode" pattern as the domain section above. */}
      <div className="mx-auto max-w-4xl w-full bg-background border border-border rounded-xl overflow-hidden mt-8">
        <div className="flex gap-1.5 px-6 pt-2">
          {Array.from({ length: 14 }).map((_, i) => (
            <div
              key={i}
              className="w-2 h-2 rounded-full bg-background border border-border"
            />
          ))}
        </div>

        <div className="px-6 pt-6 pb-2 text-center">
          <p className="label-mono text-seal mb-2">Target a company</p>
          <h2 className="text-2xl sm:text-3xl leading-tight mb-2">
            Company-specific prep packs
          </h2>
          <p className="text-sm text-muted-foreground max-w-md mx-auto">
            Practice sets styled after common campus recruiters — some curated
            from real interview experience, others AI-generated in that company's typical style.
          </p>
        </div>

        <div className="px-6 pt-6 pb-8">
          <CompanyCards mode="showcase" />
          <div className="text-center mt-5">
            <Button asChild size="sm" variant="outline">
              <a href="/prep-packs">Browse prep packs →</a>
            </Button>
          </div>
        </div>
      </div>

      {/* FAQ — hover to reveal, no click needed */}
      <div
        id="faq"
        className="mx-auto max-w-3xl w-full bg-background border border-border rounded-xl overflow-hidden mt-8 scroll-mt-24"
      >
        <div className="flex gap-1.5 px-6 pt-2">
          {Array.from({ length: 12 }).map((_, i) => (
            <div
              key={i}
              className="w-2 h-2 rounded-full bg-background border border-border"
            />
          ))}
        </div>

        <div className="px-6 pt-6 pb-2 text-center">
          <p className="label-mono text-seal mb-2">Before you start</p>
          <h2 className="text-2xl sm:text-3xl leading-tight mb-2">
            Frequently asked questions
          </h2>
          <p className="text-sm text-muted-foreground max-w-md mx-auto">
            Hover any question to reveal the answer.
          </p>
        </div>

        <div className="px-6 pt-6 pb-8 space-y-2">
          {FAQS.map((faq, i) => (
            <div
              key={i}
              className="group border border-border rounded-lg px-4 py-3 hover:border-foreground/30 hover:bg-muted/40 transition-colors"
            >
              <div className="flex items-center justify-between gap-4">
                <p className="font-heading font-medium text-sm text-foreground">
                  {faq.question}
                </p>
                <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0 transition-transform duration-200 group-hover:rotate-180" />
              </div>
              <div className="grid transition-all duration-300 ease-in-out grid-rows-[0fr] group-hover:grid-rows-[1fr]">
                <div className="overflow-hidden">
                  <p className="text-sm text-muted-foreground pt-2.5">{faq.answer}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </main>
  );
}