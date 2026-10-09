// TARGET PATH: components/site-header.tsx
"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Button } from "@/components/ui/button";
import CareerChatWidget from "@/components/career-chat-widget";

const NAV_LINKS = [
  { label: "✨ Live Avatar (Anam AI)", href: "/test-avatar" },
  { label: "FAQ", href: "/#faq" },
  { label: "What We Cover", href: "/#what-we-cover" },
  { label: "Weekly Challenge", href: "/challenge" },
  { label: "Prep Packs", href: "/prep-packs" },
  { label: "Login", href: "/login" },
];

export default function SiteHeader() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [chatOpen, setChatOpen] = useState(false);
  const pathname = usePathname();

  // Header only shows on the landing page — hidden everywhere else,
  // especially the interview flow, where it would just get in the way.
  if (pathname !== "/") return null;

  return (
    <>
      <header className="sticky top-0 z-40 bg-background border-b border-border">
        <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between">
          <Link href="/" className="font-heading font-bold text-sm text-foreground">
            AI interview practice booth
          </Link>

          {/* Desktop nav */}
          <nav className="hidden md:flex items-center gap-6">
            {NAV_LINKS.map((link) => (
              <a key={link.href} href={link.href} className="label-mono hover:text-foreground transition-colors">
                {link.label}
              </a>
            ))}

            {/* Header trigger - opens the side drawer, does NOT navigate */}
            <button
              onClick={() => setChatOpen(true)}
              className="relative flex items-center gap-1.5 label-mono border border-seal text-seal px-3 py-1.5 rounded hover:bg-seal hover:text-background transition-colors"
            >
              <span className="relative flex h-1.5 w-1.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-seal opacity-75" />
                <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-seal" />
              </span>
              Career Chat
            </button>

            <Button asChild size="sm">
              <a href="/practice">Practice Now</a>
            </Button>
          </nav>

          {/* Mobile: chat trigger (opens drawer, same as desktop) + hamburger */}
          <div className="flex items-center gap-3 md:hidden">
            <button
              onClick={() => setChatOpen(true)}
              aria-label="Career guidance chat"
              className="relative flex items-center gap-1 label-mono border border-seal text-seal px-2 py-1 rounded"
            >
              <span className="relative flex h-1.5 w-1.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-seal opacity-75" />
                <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-seal" />
              </span>
              Chat
            </button>
            <button onClick={() => setMobileOpen((v) => !v)} aria-label="Toggle menu" className="flex flex-col gap-1 w-6">
              <span className="h-0.5 bg-foreground" />
              <span className="h-0.5 bg-foreground" />
              <span className="h-0.5 bg-foreground" />
            </button>
          </div>
        </div>

        {/* Punch-hole strip - matches landing page ticket motif */}
        <div className="flex gap-1.5 px-6 pb-1.5 justify-center border-b border-border">
          {Array.from({ length: 24 }).map((_, i) => (
            <div key={i} className="w-1.5 h-1.5 rounded-full bg-background border border-border" />
          ))}
        </div>

        {/* Mobile menu */}
        {mobileOpen && (
          <nav className="md:hidden border-t border-border px-4 py-3 flex flex-col gap-3 bg-background">
            {NAV_LINKS.map((link) => (
              <a key={link.href} href={link.href} onClick={() => setMobileOpen(false)} className="label-mono">
                {link.label}
              </a>
            ))}
            <Button asChild size="sm">
              <a href="/practice" onClick={() => setMobileOpen(false)}>
                Practice Now
              </a>
            </Button>
          </nav>
        )}

        {/* Floating chat button - direct link to the full page, unaffected by the drawer */}
        <Link
          href="/career-chat"
          aria-label="Open career guidance chat page"
          className="fixed bottom-5 right-5 z-40 flex items-center gap-2 border border-seal bg-background text-seal px-4 py-3 rounded-full shadow-lg hover:bg-seal hover:text-background transition-colors"
        >
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-seal opacity-75" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-seal" />
          </span>
          <span className="label-mono hidden sm:inline">Career Chat</span>
        </Link>
      </header>

      {/* Side drawer - triggered only by the header links (desktop + mobile), works on all screen sizes */}
      {chatOpen && (
        <div className="fixed inset-0 z-50 flex justify-end">
          <div className="absolute inset-0 bg-foreground/40" onClick={() => setChatOpen(false)} />
          <div className="relative w-full max-w-sm h-full bg-background border-l border-border flex flex-col p-4">
            <button
              onClick={() => setChatOpen(false)}
              aria-label="Close chat"
              className="self-end label-mono mb-2 shrink-0"
            >
              Close ✕
            </button>
            <div className="flex-1 min-h-0">
              <CareerChatWidget compact />
            </div>
          </div>
        </div>
      )}
    </>
  );
}