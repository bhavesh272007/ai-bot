// TARGET PATH: lib/companies.ts
import {
  Building2,
  ShoppingCart,
  Search,
  MonitorSmartphone,
  Cpu,
  Boxes,
  Landmark,
  Network,
  Cloud,
  Layers,
  Briefcase,
  Rocket,
  type LucideIcon,
} from "lucide-react";

// Single source of truth for the curated company list. Deliberately NOT in
// company-cards.tsx — that file has "use client", and importing a named
// export from a client-component module into a server-side Route Handler
// doesn't resolve reliably in Next.js (this is exactly what broke
// /api/prep-pack/[company]: COMPANIES.find was not a function at runtime).
// Plain data modules like this one are safe to import from both sides.
export interface CompanyProfile {
  id: string;
  label: string;
  description: string;
  icon: LucideIcon;
}

export const COMPANIES: CompanyProfile[] = [
  { id: "tcs", label: "TCS", description: "Mass-hire IT services, aptitude-heavy screening", icon: Building2 },
  { id: "infosys", label: "Infosys", description: "Fundamentals + pseudocode coding rounds", icon: Layers },
  { id: "wipro", label: "Wipro", description: "Fundamentals, DBMS/OS focus", icon: Boxes },
  { id: "accenture", label: "Accenture", description: "Communication + technical hybrid rounds", icon: Briefcase },
  { id: "cognizant", label: "Cognizant", description: "CS fundamentals + coding basics", icon: Network },
  { id: "capgemini", label: "Capgemini", description: "Aptitude, coding & HR rounds", icon: Landmark },
  { id: "hcltech", label: "HCLTech", description: "Core CS + project-based questions", icon: Cpu },
  { id: "tech-mahindra", label: "Tech Mahindra", description: "Fundamentals & communication rounds", icon: MonitorSmartphone },
  { id: "amazon", label: "Amazon", description: "DSA-heavy + leadership-principle behavioral", icon: ShoppingCart },
  { id: "google", label: "Google", description: "Strong DSA + problem-solving depth", icon: Search },
  { id: "microsoft", label: "Microsoft", description: "DSA + system fundamentals", icon: Cloud },
  { id: "deloitte", label: "Deloitte", description: "Case-style + technical hybrid rounds", icon: Rocket },
];