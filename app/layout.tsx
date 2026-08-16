// TARGET PATH: app/layout.tsx
import type { Metadata } from "next";
import Script from "next/script";
import { Space_Grotesk, IBM_Plex_Sans, IBM_Plex_Mono, Caveat } from "next/font/google";
import "./globals.css";
import { cn } from "@/lib/utils";
import { ThemeProvider } from "@/lib/theme-provider";

const spaceGrotesk = Space_Grotesk({
  subsets: ["latin"],
  weight: ["500", "700"],
  variable: "--font-heading",
});

const plexSans = IBM_Plex_Sans({
  subsets: ["latin"],
  weight: ["400", "500"],
  variable: "--font-sans",
});

const plexMono = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["400", "500"],
  variable: "--font-mono",
});

const caveat = Caveat({
  subsets: ["latin"],
  weight: ["600"],
  variable: "--font-hand",
});

export const metadata: Metadata = {
  title: "AI Interview Practice Booth",
  description:
    "AI-generated, AI-scored practice interviews for engineering placements — question rounds, live coding, and voice practice in one link.",
};

// Runs before hydration so there's no flash of the wrong theme.
// Reads localStorage first, falls back to the OS preference.
const noFlashScript = `
(function() {
  try {
    var stored = localStorage.getItem('theme');
    var theme = stored || (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
    if (theme === 'dark') document.documentElement.classList.add('dark');
  } catch (e) {}
})();
`;

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={cn(
        "h-full",
        "antialiased",
        spaceGrotesk.variable,
        plexSans.variable,
        plexMono.variable,
        caveat.variable,
        "font-sans"
      )}
    >
      <head>
        <Script
          id="theme-no-flash"
          strategy="beforeInteractive"
          dangerouslySetInnerHTML={{ __html: noFlashScript }}
        />
      </head>
      <body className="min-h-full flex flex-col">
        <ThemeProvider>{children}</ThemeProvider>
      </body>
    </html>
  );
}