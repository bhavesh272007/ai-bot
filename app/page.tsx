// TARGET PATH: app/page.tsx
// Replaces the old Hall Ticket landing page. Header/nav is now inlined here

"use client";

import { useState } from "react";
import type { CSSProperties } from "react";
import Link from "next/link";
import {
  Code2, Network, BarChart3, Brain, Package, Cloud, Globe, Database, ShieldCheck,
  Building2, Layers, Hexagon, Briefcase, Share2, Landmark, Cpu, Smartphone,
  ShoppingCart, Search, AppWindow, Rocket,
} from "lucide-react";
import CareerChatWidget from "@/components/career-chat-widget";
import styles from "./page.module.css";

const FAQS = [
  {
    q: "Do I need to create an account to practice?",
    a: "No. Self-practice mode is completely open — pick a role and go. Accounts only exist for recruiters who want to generate and track interviews for real candidates.",
  },
  {
    q: "Will a recruiter ever see my practice results?",
    a: "No. Practice sessions started from this site are never linked to any recruiter or dashboard. They exist only for you, to help you prepare.",
  },
  {
    q: "What does a full interview actually cover?",
    a: "Every interview has two rounds: a question-and-answer round covering CS fundamentals, DSA, your experience, and behavioral questions, followed by a live coding round with real test cases — both scored by AI.",
  },
  {
    q: "Can I choose what kind of interview to practice?",
    a: "Yes. On the practice page you can pick a focus — Behavioral, Technical, HR & Situational, or Industry-Specific — and the questions generated will be weighted toward that style.",
  },
  {
    q: "How are my answers actually scored?",
    a: "An AI model reads each answer and scores it out of 10 on correctness, clarity, and depth, with specific feedback on strengths and what to improve — the same way for the coding round, based on test results and code quality.",
  },
  {
    q: "What programming languages does the coding round support?",
    a: "JavaScript, Python, Java, and C++. You can switch languages before submitting, and your code runs against real test cases before it's scored.",
  },
  {
    q: "Can I keep a copy of my results?",
    a: "Yes. After finishing the coding round you can download a PDF report with your full Q&A breakdown and coding score to keep for your own tracking.",
  },
  {
    q: "How does the recruiter side work?",
    a: "A recruiter pastes a job description, AI generates tailored questions, and they get a shareable link. Candidates open the link and answer directly — no account needed on the candidate's end.",
  },
];

const DOMAINS = [
  { title: "Software Engineering", desc: "DSA, coding & problem solving", Icon: Code2 },
  { title: "System Design", desc: "Scalable systems & architecture", Icon: Network },
  { title: "Data Analytics", desc: "SQL, metrics & dashboards", Icon: BarChart3 },
  { title: "Data Science & ML", desc: "Stats, ML models & case studies", Icon: Brain },
  { title: "Product Management", desc: "Product sense & strategy rounds", Icon: Package },
  { title: "Cloud & DevOps", desc: "AWS, CI/CD & infrastructure", Icon: Cloud },
  { title: "FullStack Development", desc: "Frontend, APIs & deployment", Icon: Globe },
  { title: "Data Engineering", desc: "ETL, Spark & pipeline internals", Icon: Database },
  { title: "QA & Test Engineering", desc: "Automation & test strategy", Icon: ShieldCheck },
];

const COMPANIES = [
  { name: "TCS", tag: "Mass-hire IT services, aptitude-heavy rounds", Icon: Building2 },
  { name: "Infosys", tag: "Fundamentals + pseudocode coding", Icon: Layers },
  { name: "Wipro", tag: "Fundamentals, DBMS/OS focus", Icon: Hexagon },
  { name: "Accenture", tag: "Communication + technical hybrid rounds", Icon: Briefcase },
  { name: "Cognizant", tag: "CS fundamentals + coding basics", Icon: Share2 },
  { name: "Capgemini", tag: "Aptitude, coding & HR rounds", Icon: Landmark },
  { name: "HCLTech", tag: "Core CS + project-based questions", Icon: Cpu },
  { name: "Tech Mahindra", tag: "Fundamentals & communication rounds", Icon: Smartphone },
  { name: "Amazon", tag: "DSA-heavy + leadership-principle questions", Icon: ShoppingCart },
  { name: "Google", tag: "Strong DSA + problem-solving depth", Icon: Search },
  { name: "Microsoft", tag: "DSA + system fundamentals", Icon: AppWindow },
  { name: "Deloitte", tag: "Case-style + technical hybrid rounds", Icon: Rocket },
];

function ChevronIcon() {
  return (
    <svg className={styles.faqChevron} viewBox="0 0 20 20" fill="none">
      <path d="M5 7.5L10 12.5L15 7.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

export default function LandingPage() {
  const [chatOpen, setChatOpen] = useState(false);

  return (
    <div className={styles.page}>
      <div className={styles.hero}>
        {/* ---------- NAV (inlined — no site-header.tsx) ---------- */}
        <nav className={styles.siteNav}>
          <div className={styles.logo}>
            <span className={styles.logoBadge}>AI</span>
            Interview Booth
          </div>
          <ul className={styles.navLinks}>
            <li><a href="#domains">Domains</a></li>
            <li><Link href="/challenge">Weekly Challenge</Link></li>
            <li><a href="#prep-packs">Prep Packs</a></li>
            <li><Link href="/candidate/dashboard">My Progress</Link></li>
            <li><a href="#faq">FAQ</a></li>
          </ul>
          <div className={styles.navRight}>
            <button type="button" onClick={() => setChatOpen(true)} className={styles.navCareerChat}>
              <span className={styles.navCareerChatDot}>
                <span className={styles.navCareerChatDotPing} />
                <span className={styles.navCareerChatDotCore} />
              </span>
              Career Chat
            </button>
            <Link href="/login" className={styles.btnLogin}>Recruiter login</Link>
            <Link href="/practice" className={styles.btnGetstarted}>Start Practicing</Link>
          </div>
        </nav>

        {/* ---------- HERO ---------- */}
        <div className={styles.heroContent}>
          <span className={styles.heroNote}>good luck!</span>
          <h1>
            Practice interviews.
            <br />
            <span className={styles.highlight}>
              Get placed.
              <svg width="260" height="16" viewBox="0 0 260 16" fill="none">
                <path d="M2 9 C 50 3, 100 13, 150 6 S 220 10, 258 5" stroke="#a63d40" strokeWidth="2.5" fill="none" strokeLinecap="round" />
              </svg>
            </span>
          </h1>
          <p className={styles.heroSub}>
            AI-generated questions, live coding rounds, and voice practice — scored like the real thing, across HR, behavioral, technical, and industry-specific domains.
          </p>
          <div className={styles.heroButtons}>
            <Link href="/practice" className={styles.btnStart}>Start Practicing</Link>
          </div>
        </div>

        {/* ---------- CANDIDATE / RECRUITER / AVATAR SPLIT ---------- */}
        <div className={styles.splitWrap}>
          <div className={styles.splitCard}>
            <div className={styles.splitEyebrow}>Candidate stub</div>
            <h3>Have a link?</h3>
            <p>Open it directly and start answering. No account needed — practice sessions are never linked to any recruiter or dashboard.</p>
            <Link className={styles.splitTrack} href="/practice">Practice without a link →</Link>
          </div>
          <div className={styles.splitCard}>
            <div className={styles.splitEyebrow}>Recruiter stub</div>
            <h3>Creating interviews?</h3>
            <p>Paste a job description, get AI-generated questions, and share a link. Candidates answer directly — no account needed on their end.</p>
            <Link className={styles.splitTrack} href="/login">Recruiter login →</Link>
          </div>
        </div>
      </div>

      {/* ---------- TYPES OF MOCK INTERVIEW PRACTICE ---------- */}
      <section className={styles.section} id="what-we-cover">
        <div className={styles.sectionHead}>
          <div className={styles.eyebrow}>What we cover</div>
          <h2>Types of mock interview practice</h2>
          <p>Whether you&apos;re a fresher preparing for campus placements or targeting a specific company, our AI covers every interview format.</p>
        </div>

        <div className={styles.featureGrid}>
          <div className={styles.featureCard} style={{ "--accent": "#2f6e51" } as CSSProperties}>
            <h3>Technical</h3>
            <p>Simulate coding and system design interviews with real-time feedback.</p>
          </div>

          <div className={styles.featureCard} style={{ "--accent": "#111111" } as CSSProperties}>
            <h3>Behavioral</h3>
            <p>Practice STAR-format answers and get instant feedback on your delivery.</p>
          </div>

          <div className={styles.featureCard} style={{ "--accent": "#c89b3c" } as CSSProperties}>
            <h3>HR</h3>
            <p>Master common HR questions and align your responses with role expectations.</p>
          </div>

          <div className={styles.featureCard} style={{ "--accent": "#a63d40" } as CSSProperties}>
            <h3>Industry</h3>
            <p>Prepare for domain-specific questions across software, fintech, and more.</p>
          </div>
        </div>
      </section>

      {/* ---------- BUILT ON ONE PRACTICE BOOTH ---------- */}
      <section className={`${styles.section} ${styles.platformSection}`}>
        <div className={styles.platformBadge}>AI</div>
        <h2>Everything an interview actually needs.</h2>
        <p>Not a question bank bolted onto a timer. One system that asks, listens, runs your code, and scores it — the way a real panel would.</p>

        <div className={styles.platformGrid}>
          <div>
            <div className={styles.platformIcon}>🚀</div>
            <h3>Two-round interviews</h3>
            <p>A Q&amp;A round covering CS fundamentals, DSA, experience, and behavioral questions, then a live coding round with real test cases.</p>
          </div>
          <div>
            <div className={styles.platformIcon}>✨</div>
            <h3>AI scoring</h3>
            <p>Every answer is scored out of 10 on correctness, clarity, and depth — with specific feedback on what to improve.</p>
          </div>
          <div>
            <div className={styles.platformIcon}>↻</div>
            <h3>Keep your results</h3>
            <p>Download a PDF report with your full Q&amp;A breakdown and coding score to track your progress over time.</p>
          </div>
        </div>
      </section>

      {/* ---------- PRACTICE BY DOMAIN ---------- */}
      <section className={styles.section} id="domains">
        <div className={styles.sectionHead}>
          <div className={styles.eyebrow}>Pick your track</div>
          <h2>Practice interviews by domain</h2>
          <p>From core software roles to specialized tracks — choose your domain when you start practicing.</p>
        </div>

        <div className={styles.domainGrid}>
          {DOMAINS.map((d) => (
            <div key={d.title} className={styles.domainCard}>
              <div className={styles.domainIconWrap}>
                <d.Icon size={20} strokeWidth={1.75} />
              </div>
              <h3>{d.title}</h3>
              <p>{d.desc}</p>
            </div>
          ))}
        </div>

        <div className={styles.domainCtaWrap}>
          <Link href="/practice" className={styles.domainCta}>Choose your domain →</Link>
        </div>
      </section>

      {/* ---------- INTERVIEWER PERSONALITIES ---------- */}
      <section className={`${styles.section} ${styles.personalitySection}`} id="personalities">
        <div className={styles.sectionHead}>
          <div className={styles.eyebrow}>Set the tone</div>
          <h2>
            Choose your interviewer&apos;s personality
            <span className={styles.headingNewBadge}>NEW</span>
          </h2>
          <p>The same questions, three different examiners — pick who grills you before you start.</p>
        </div>

        <div className={styles.personalityGrid}>
          <div className={`${styles.personalityCard} ${styles.personalityStrict}`}>
            <h3><span className={styles.personalityDot}></span>Strict Panel</h3>
            <p>No small talk, tight follow-ups, and little patience for vague answers — built to simulate high-pressure panel rounds.</p>
          </div>
          <div className={`${styles.personalityCard} ${styles.personalityFriendly}`}>
            <h3><span className={styles.personalityDot}></span>Friendly HR</h3>
            <p>Warm, conversational, and encouraging — helps you practice structure and delivery without the added pressure.</p>
          </div>
          <div className={`${styles.personalityCard} ${styles.personalityRapid}`}>
            <h3><span className={styles.personalityDot}></span>Rapid-Fire Technical</h3>
            <p>Quick, back-to-back technical questions that test how fast and clearly you can think on your feet.</p>
          </div>
        </div>
      </section>

      {/* ---------- CODING ROUND ---------- */}
      <section className={`${styles.section} ${styles.engSection}`}>
        <div className={styles.engLeft}>
          <h2>A coding round with real test cases</h2>
          <p>JavaScript, Python, Java, or C++ — write code, run it against real test cases, and get AI feedback on correctness and code quality.</p>
          <Link className={styles.explore} href="/sample-coding">Try a sample coding round →</Link>

          <div className={styles.engFeatures}>
            <div>
              <div className={styles.engFeatIcon}>⌘</div>
              <h4>Choose your track</h4>
              <p>Pick from HR, behavioral, technical, and industry-specific interview tracks tailored to your target role.</p>
            </div>
            <div>
              <div className={styles.engFeatIcon}>⚡</div>
              <h4>Real-time feedback</h4>
              <p>Receive instant, actionable feedback on your answers, tone, and structure to improve with every session.</p>
            </div>
            <div>
              <div className={styles.engFeatIcon}>▤</div>
              <h4>Realistic simulations</h4>
              <p>Simulate real interview conditions with timed questions, follow-ups, and pressure scenarios.</p>
            </div>
            <div>
              <div className={styles.engFeatIcon}>🛡</div>
              <h4>Progress analytics</h4>
              <p>Track your progress across skills and domains to focus your preparation where it matters most.</p>
            </div>
          </div>
        </div>

        <div className={styles.codePanel}>
          <span className={styles.ln}>1</span> <span className={styles.com}>// submit a coding round</span><br />
          <span className={styles.ln}>2</span> <span className={styles.kw}>const</span> result = <span className={styles.kw}>await</span> booth.rounds.<span className={styles.fn}>submit</span>({"{"}<br />
          <span className={styles.ln}>3</span>&nbsp;&nbsp;candidate: <span className={styles.str}>&quot;cand_9fQ2p&quot;</span>,<br />
          <span className={styles.ln}>4</span>&nbsp;&nbsp;language: <span className={styles.str}>&quot;python&quot;</span>,<br />
          <span className={styles.ln}>5</span>&nbsp;&nbsp;domain: <span className={styles.str}>&quot;backend&quot;</span>,<br />
          <span className={styles.ln}>6</span>&nbsp;&nbsp;testCases: <span className={styles.num}>14</span>,<br />
          <span className={styles.ln}>7</span>&nbsp;&nbsp;interviewer: {"{"}<br />
          <span className={styles.ln}>8</span>&nbsp;&nbsp;&nbsp;&nbsp;persona: <span className={styles.str}>&quot;rapid_fire_technical&quot;</span><br />
          <span className={styles.ln}>9</span>&nbsp;&nbsp;{"}"}<br />
          <span className={styles.ln}>10</span>{"});"}<br />
          <span className={styles.ln}>11</span><br />
          <span className={styles.ln}>12</span> <span className={styles.key}>return</span> {"{"}<br />
          <span className={styles.ln}>13</span>&nbsp;&nbsp;score: <span className={styles.num}>8.5</span>,<br />
          <span className={styles.ln}>14</span>&nbsp;&nbsp;testsPassed: <span className={styles.str}>&quot;13/14&quot;</span>,<br />
          <span className={styles.ln}>15</span>&nbsp;&nbsp;feedback: <span className={styles.str}>&quot;clean, minor edge case missed&quot;</span><br />
          <span className={styles.ln}>16</span>{"};"}<br />
          <span className={styles.ln}>17</span><br />
          <span className={styles.ln}>18</span> <span className={styles.com}>// 200 OK · 212ms</span>
        </div>
      </section>

      {/* ---------- COMPANY-SPECIFIC PREP PACKS ---------- */}
      <section className={styles.section} id="prep-packs">
        <div className={styles.sectionHead}>
          <div className={styles.eyebrow}>Target a company</div>
          <h2>Company-specific prep packs</h2>
          <p>Practice sets styled after common campus recruiters — some curated from real interview experience, others AI-generated in that company&apos;s typical style.</p>
        </div>

        <div className={styles.companyGrid}>
          {COMPANIES.map((c) => (
            <div key={c.name} className={styles.companyCard}>
              <div className={styles.companyMark}>
                <c.Icon size={17} strokeWidth={1.75} />
              </div>
              <div>
                <h4>{c.name}</h4>
                <p>{c.tag}</p>
              </div>
            </div>
          ))}
        </div>

        <div className={styles.tagStrip} style={{ borderTop: "none", paddingTop: 0 }}>
          <Link href="/prep-packs" className={styles.btnSample}>Browse prep packs →</Link>
        </div>
      </section>

      {/* ---------- FAQ ---------- */}
      <section className={`${styles.section} ${styles.faqSection}`} id="faq">
        <div className={styles.sectionHead}>
          <div className={styles.eyebrow}>Before you start</div>
          <h2>Frequently asked questions</h2>
          <p>Hover any question to reveal the answer.</p>
        </div>

        <div className={styles.faqList}>
          {FAQS.map((f) => (
            <div key={f.q} className={styles.faqItem}>
              <div className={styles.faqQ}>
                <p>{f.q}</p>
                <ChevronIcon />
              </div>
              <div className={styles.faqA}>
                <div className={styles.faqAInner}>
                  <p>{f.a}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ---------- FOOTER ---------- */}
      <footer className={styles.siteFooter}>
        <div className={styles.footerCta}>
          <h2>Ready to walk in prepared?</h2>
          <p>Start a free practice round right now — no account, no setup, just questions and instant feedback.</p>
          <div className={styles.heroButtons}>
            <Link href="/practice" className={styles.btnStart}>Start Practicing</Link>
          </div>
        </div>

        <div className={styles.footerMain}>
          <div className={styles.footerBrand}>
            <div className={styles.logo}>
              <span className={styles.logoBadge}>AI</span>
              Interview Booth
            </div>
            <p>AI-generated questions, live coding rounds, and voice practice — scored like the real thing.</p>
          </div>
          <div className={styles.footerCol}>
            <h4>Practice</h4>
            <ul>
              <li><a href="#what-we-cover">Interview types</a></li>
              <li><a href="#domains">Domains</a></li>
              <li><a href="#personalities">Interviewer personalities</a></li>
              <li><a href="#prep-packs">Prep packs</a></li>
              <li><Link href="/candidate/dashboard">My progress</Link></li>
            </ul>
          </div>
          <div className={styles.footerCol}>
            <h4>Company</h4>
            <ul>
              <li><a href="#">About</a></li>
              <li><a href="#">Careers</a></li>
              <li><a href="#">Blog</a></li>
              <li><a href="#">Contact</a></li>
            </ul>
          </div>
          <div className={styles.footerCol}>
            <h4>Recruiters</h4>
            <ul>
              <li><Link href="/login">Recruiter login</Link></li>
              <li><Link href="/create">Generate an interview</Link></li>
              <li><a href="#">Pricing</a></li>
              <li><a href="#faq">FAQ</a></li>
            </ul>
          </div>
        </div>

        <div className={styles.footerBottom}>
          <span>© 2026 AI Interview Practice Booth. All rights reserved.</span>
          <div className={styles.footerLegal}>
            <a href="#">Privacy</a>
            <a href="#">Terms</a>
            <a href="#">Security</a>
          </div>
        </div>
      </footer>

      {/* ---------- FLOATING CAREER CHAT BUTTON (restored — was lost when
          site-header.tsx stopped being used; links to the full page, unlike
          the nav trigger above which opens the drawer) ---------- */}
      <Link href="/career-chat" className={styles.floatingCareerChat} aria-label="Open career guidance chat">
        <span className={styles.navCareerChatDot}>
          <span className={styles.navCareerChatDotPing} />
          <span className={styles.navCareerChatDotCore} />
        </span>
        Career Chat
      </Link>

      {/* ---------- CAREER CHAT DRAWER (ported from site-header.tsx) ---------- */}
      {chatOpen && (
        <div className={styles.chatOverlay} onClick={() => setChatOpen(false)}>
          <div className={styles.chatDrawer} onClick={(e) => e.stopPropagation()}>
            <button type="button" className={styles.chatDrawerClose} onClick={() => setChatOpen(false)}>
              Close ✕
            </button>
            <div style={{ flex: 1, minHeight: 0 }}>
              <CareerChatWidget compact />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
