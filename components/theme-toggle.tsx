// components/theme-toggle.tsx
"use client";

import { Sun, Moon } from "lucide-react";
import { useTheme } from "@/lib/theme-provider";
import { cn } from "@/lib/utils";

export function ThemeToggle({ className }: { className?: string }) {
  const { theme, toggleTheme } = useTheme();
  const isDark = theme === "dark";

  return (
    <button
      type="button"
      role="switch"
      aria-checked={isDark}
      aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
      onClick={toggleTheme}
      className={cn(
        "group relative inline-flex h-8 w-16 shrink-0 items-center rounded-full border transition-colors duration-300",
        "border-border bg-secondary",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
        className
      )}
    >
      {/* perforated tear-edge, ticket-stub styling */}
      <span
        aria-hidden
        className="pointer-events-none absolute inset-y-1.5 left-2 flex flex-col justify-between opacity-40"
      >
        <span className="h-0.5 w-0.5 rounded-full bg-muted-foreground" />
        <span className="h-0.5 w-0.5 rounded-full bg-muted-foreground" />
        <span className="h-0.5 w-0.5 rounded-full bg-muted-foreground" />
      </span>

      {/* sliding ink-stamp knob, same blob shape as .seal-badge */}
      <span
        aria-hidden
        className={cn(
          "absolute top-1 flex h-6 w-6 items-center justify-center shadow-sm transition-all duration-300 ease-out",
          "bg-seal text-primary-foreground",
          isDark ? "left-[calc(100%-1.75rem)] -rotate-6" : "left-1 rotate-3"
        )}
        style={{ borderRadius: "42% 58% 63% 37% / 41% 44% 56% 59%" }}
      >
        {isDark ? (
          <Moon className="h-3.5 w-3.5" strokeWidth={2.5} />
        ) : (
          <Sun className="h-3.5 w-3.5" strokeWidth={2.5} />
        )}
      </span>
    </button>
  );
}