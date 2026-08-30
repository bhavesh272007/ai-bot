// TARGET PATH: app/api/session-report/[sessionId]/route.ts
// Generates a single PDF combining a candidate's Q&A round results and their
// coding round results (if the coding submission was linked via session_id —
// see the coding_sessions migration). Streams the PDF back for download.

import { NextRequest } from "next/server";
import { PDFDocument, StandardFonts, rgb, PDFFont, PDFPage } from "pdf-lib";
import { supabase } from "@/lib/supabase";
import { toDisplayScore } from "@/lib/scoring";

// ---------- Theme colors (from globals.css) ----------
const INK = hexToRgb("#14213D");
const SEAL = hexToRgb("#C89B3C");
const VERIFIED = hexToRgb("#2F6E51");
const DESTRUCTIVE = hexToRgb("#A63D40");
const MUTED = hexToRgb("#6B6A63");
const BORDER = hexToRgb("#D8D5C9");
const PAPER = hexToRgb("#FAFAF7");

function hexToRgb(hex: string) {
  const r = parseInt(hex.slice(1, 3), 16) / 255;
  const g = parseInt(hex.slice(3, 5), 16) / 255;
  const b = parseInt(hex.slice(5, 7), 16) / 255;
  return rgb(r, g, b);
}

function scoreColor(score: number) {
  if (score >= 7) return VERIFIED;
  if (score >= 4) return SEAL;
  return DESTRUCTIVE;
}

// pdf-lib's standard fonts (Helvetica, Courier, etc.) use WinAnsi encoding,
// which only covers a Latin-1-ish character set. AI-generated text (from Groq)
// can contain "smart" Unicode punctuation — non-breaking hyphens, curly quotes,
// em dashes, ellipsis, bullets — that WinAnsi can't encode, and pdf-lib throws
// instead of skipping the character. Normalize before anything reaches drawText.
function sanitizeForPdf(text: string): string {
  if (!text) return "";
  return text
    .replace(/[\u2010\u2011\u2012\u2013\u2014\u2015]/g, "-") // hyphens/dashes incl. non-breaking hyphen
    .replace(/[\u2018\u2019\u201A\u201B]/g, "'") // curly single quotes
    .replace(/[\u201C\u201D\u201E\u201F]/g, '"') // curly double quotes
    .replace(/\u2026/g, "...") // ellipsis
    .replace(/[\u2022\u25CF\u25AA]/g, "-") // bullet variants
    .replace(/\u00A0/g, " ") // non-breaking space
    .replace(/[^\x00-\xFF]/g, "?"); // anything else outside WinAnsi/Latin-1 range — fallback so we never crash
}

const PAGE_WIDTH = 595.28; // A4
const PAGE_HEIGHT = 841.89;
const MARGIN = 50;
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN * 2;

function wrapText(text: string, font: PDFFont, size: number, maxWidth: number): string[] {
  const clean = sanitizeForPdf(text);
  const words = clean.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let current = "";

  for (const word of words) {
    const test = current ? `${current} ${word}` : word;
    if (font.widthOfTextAtSize(test, size) > maxWidth && current) {
      lines.push(current);
      current = word;
    } else {
      current = test;
    }
  }
  if (current) lines.push(current);
  return lines.length > 0 ? lines : [""];
}

interface SessionReportData {
  session: any;
  answers: any[];
  interview: any;
  coding_session: any;
  coding_question: any;
}

// ---------- Readiness score (mirrors app/candidate/dashboard/page.tsx) ----------
// This is duplicated rather than imported because it lives client-side on
// the dashboard and this is a server route with different available data
// (a single session's report, not the full candidate history already in
// memory). If the formula in the dashboard ever changes, update both.
type Trend = "up" | "down" | "flat" | "insufficient";
const TREND_DEADZONE_PCT = 0.05;

function computeTrend(scoresAsc: number[]): Trend {
  if (scoresAsc.length < 2) return "insufficient";
  const prev = scoresAsc[scoresAsc.length - 2];
  const latest = scoresAsc[scoresAsc.length - 1];
  const delta = latest - prev;
  if (prev === 0) return delta > 0 ? "up" : "flat";
  if (Math.abs(delta) / prev < TREND_DEADZONE_PCT) return "flat";
  return delta > 0 ? "up" : "down";
}

// Same weights as computeReadinessScore() in the candidate dashboard: 60%
// latest score, up to 25% for trend direction, up to 15% for an active
// streak (capped at a 7-day contribution).
function computeReadinessScore(latestScore: number, trend: Trend, currentStreak: number): number {
  const scorePart = toDisplayScore(latestScore) * 0.6;
  const trendPart = { up: 25, flat: 15, insufficient: 15, down: 5 }[trend];
  const streakPart = (Math.min(currentStreak, 7) / 7) * 15;
  return Math.round(Math.min(100, scorePart + trendPart + streakPart));
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  try {
    const { sessionId } = await params;

    if (!sessionId) {
      return Response.json({ error: "Missing session id." }, { status: 400 });
    }

    // ---------- Fetch data via the report function ----------
    // (single scoped call instead of five separate direct table reads —
    // this is the only anon read path into these tables now that RLS
    // blocks direct SELECTs on sessions/session_answers/coding_sessions)
    const { data: report, error: reportError } = await supabase
      .rpc("get_session_report", { p_session_id: sessionId })
      .single<SessionReportData>();

    if (reportError || !report || !report.session) {
      return Response.json({ error: "Session not found." }, { status: 404 });
    }

    const session = report.session;
    const answers = report.answers || [];
    const interview = report.interview;
    const codingSession = report.coding_session;
    const codingQuestion = report.coding_question;

    // ---------- Readiness score (best-effort — never blocks the report) ----------
    // NOTE: assumes session.candidate_email is included in what
    // get_session_report() returns. If it isn't, this silently skips the
    // stamp rather than failing — add that column to the function's SELECT
    // if you want this to actually populate.
    let readinessScore: number | null = null;
    if (session?.candidate_email) {
      try {
        const [{ data: historyRows }, { data: streakData }] = await Promise.all([
          supabase.rpc("get_candidate_history", { p_email: session.candidate_email }),
          supabase.rpc("get_candidate_streak", { p_email: session.candidate_email }),
        ]);

        const scoresAsc = (historyRows || [])
          .map((r: any) => r.overall_score)
          .filter((s: any): s is number => s !== null);

        if (scoresAsc.length > 0) {
          const latestScore = scoresAsc[scoresAsc.length - 1];
          const trend = computeTrend(scoresAsc);
          const currentStreak = streakData?.current_streak ?? 0;
          readinessScore = computeReadinessScore(latestScore, trend, currentStreak);
        }
      } catch (err) {
        console.error("readiness score computation failed (non-fatal, report continues):", err);
      }
    }


    // ---------- Build PDF ----------
    const pdfDoc = await PDFDocument.create();
    const fontRegular = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
    const fontMono = await pdfDoc.embedFont(StandardFonts.Courier);

    let page = pdfDoc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
    let y = PAGE_HEIGHT;

    function newPage() {
      page = pdfDoc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
      y = PAGE_HEIGHT - MARGIN;
    }

    function ensureSpace(needed: number) {
      if (y - needed < MARGIN) newPage();
    }

    function drawHeaderBar() {
      page.drawRectangle({ x: 0, y: PAGE_HEIGHT - 70, width: PAGE_WIDTH, height: 70, color: INK });
      page.drawText("AI INTERVIEW PRACTICE BOOTH", {
        x: MARGIN,
        y: PAGE_HEIGHT - 32,
        size: 14,
        font: fontBold,
        color: PAPER,
      });
      page.drawText("Candidate Result Report", {
        x: MARGIN,
        y: PAGE_HEIGHT - 50,
        size: 10,
        font: fontRegular,
        color: PAPER,
      });
      y = PAGE_HEIGHT - 70 - 30;
    }

    function drawLabel(text: string) {
      ensureSpace(16);
      page.drawText(sanitizeForPdf(text).toUpperCase(), {
        x: MARGIN,
        y,
        size: 8,
        font: fontMono,
        color: MUTED,
      });
      y -= 16;
    }

    function drawHeading(text: string) {
      ensureSpace(24);
      page.drawText(sanitizeForPdf(text), { x: MARGIN, y, size: 14, font: fontBold, color: INK });
      y -= 10;
      page.drawLine({
        start: { x: MARGIN, y },
        end: { x: PAGE_WIDTH - MARGIN, y },
        thickness: 1,
        color: BORDER,
      });
      y -= 16;
    }

    function drawParagraph(text: string, opts?: { size?: number; color?: ReturnType<typeof rgb>; font?: PDFFont; lineHeight?: number }) {
      const size = opts?.size ?? 10;
      const color = opts?.color ?? INK;
      const font = opts?.font ?? fontRegular;
      const lineHeight = opts?.lineHeight ?? 14;
      const lines = wrapText(text, font, size, CONTENT_WIDTH); // wrapText sanitizes internally
      for (const line of lines) {
        ensureSpace(lineHeight);
        page.drawText(line, { x: MARGIN, y, size, font, color });
        y -= lineHeight;
      }
    }

    // Badge width is fixed in points, so it needs to fit "100/100" (7 chars)
    // rather than the old "10/10" (5 chars) — widened from 60 to 74 so the
    // text doesn't run into the label beside it.
    function drawScoreBadge(score: number, label: string) {
      ensureSpace(30);
      const color = scoreColor(score);
      page.drawRectangle({ x: MARGIN, y: y - 22, width: 74, height: 24, color, opacity: 1 });
      page.drawText(`${toDisplayScore(score)}/100`, {
        x: MARGIN + 8,
        y: y - 15,
        size: 11,
        font: fontBold,
        color: PAPER,
      });
      page.drawText(sanitizeForPdf(label), {
        x: MARGIN + 84,
        y: y - 15,
        size: 10,
        font: fontRegular,
        color: MUTED,
      });
      y -= 34;
    }

    function spacer(h: number) {
      y -= h;
    }

    // Styled distinctly from drawScoreBadge (wider, standalone) so it reads
    // as a headline stat rather than one of several per-question scores.
    function drawReadinessStamp(score: number) {
      ensureSpace(40);
      const color = scoreColor(score / 10); // scoreColor expects a 0-10 scale
      page.drawRectangle({ x: MARGIN, y: y - 30, width: 190, height: 32, color, opacity: 1 });
      page.drawText(`READINESS SCORE: ${score}/100`, {
        x: MARGIN + 12,
        y: y - 20,
        size: 12,
        font: fontBold,
        color: PAPER,
      });
      y -= 44;
    }

    // ---------- Header ----------
    drawHeaderBar();

    const dateStr = new Date(session.created_at).toLocaleString();
    const context = interview?.is_practice
      ? `${interview.target_role || "Practice session"}${
          interview.target_company ? ` @ ${interview.target_company}` : ""
        }${interview.target_level ? ` · ${interview.target_level}` : ""}`
      : "Recruiter-shared interview";

    drawLabel(`Generated ${dateStr}`);
    drawLabel(`Session ${sessionId.slice(0, 8).toUpperCase()}`);
    drawParagraph(context, { size: 11, color: INK, font: fontBold, lineHeight: 16 });
    spacer(10);

    if (readinessScore !== null) {
      drawReadinessStamp(readinessScore);
    }

    // ---------- Q&A Round ----------
    drawHeading("Question & Answer Round");
    if (session.overall_score !== null) {
      drawScoreBadge(Number(session.overall_score), "Overall Q&A score");
    }
    if (session.overall_feedback) {
      drawParagraph(session.overall_feedback, { color: MUTED });
      spacer(10);
    }

    if (answers && answers.length > 0) {
      for (const a of answers) {
        ensureSpace(20);
        drawParagraph(a.question_text, { size: 10, font: fontBold, lineHeight: 14 });
        if (a.score !== null) {
          drawParagraph(`Score: ${toDisplayScore(Number(a.score))}/100`, {
            size: 9,
            font: fontMono,
            color: scoreColor(Number(a.score)),
            lineHeight: 12,
          });
        }
        if (a.strengths) {
          drawParagraph(`Strengths: ${a.strengths}`, { size: 9, color: VERIFIED, lineHeight: 12 });
        }
        if (a.improvements) {
          drawParagraph(`Improve: ${a.improvements}`, { size: 9, color: SEAL, lineHeight: 12 });
        }
        spacer(10);
      }
    } else {
      drawParagraph("No Q&A answers recorded for this session.", { color: MUTED });
    }

    spacer(6);

    // ---------- Coding Round ----------
    drawHeading("Coding Round");
    if (codingSession) {
      if (codingQuestion?.title) {
        drawParagraph(codingQuestion.title, { size: 11, font: fontBold, lineHeight: 15 });
      }
      if (codingSession.ai_score !== null) {
        drawScoreBadge(Number(codingSession.ai_score), "Coding score");
      }
      drawParagraph(
        `Language: ${codingSession.language || "—"}   ·   Tests passed: ${
          codingSession.tests_passed ?? "—"
        }/${codingSession.tests_total ?? "—"}`,
        { size: 9, font: fontMono, color: MUTED, lineHeight: 12 }
      );
      spacer(6);
      if (codingSession.ai_feedback) {
        drawParagraph(codingSession.ai_feedback, { color: MUTED });
      }
    } else {
      drawParagraph(
        "No coding round submission is linked to this session.",
        { color: MUTED }
      );
    }

    // ---------- Footer ----------
    ensureSpace(30);
    spacer(10);
    page.drawLine({
      start: { x: MARGIN, y },
      end: { x: PAGE_WIDTH - MARGIN, y },
      thickness: 1,
      color: BORDER,
    });
    y -= 14;
    page.drawText(
      "Generated by AI Interview Practice Booth — self-assessment tool, not an official certification.",
      { x: MARGIN, y, size: 8, font: fontMono, color: MUTED }
    );

    const pdfBytes = await pdfDoc.save();

    return new Response(new Uint8Array(pdfBytes), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="interview-report-${sessionId.slice(0, 8)}.pdf"`,
      },
    });
  } catch (err) {
    console.error("session-report error:", err);
    return Response.json(
      { error: "Something went wrong generating the report." },
      { status: 500 }
    );
  }
}