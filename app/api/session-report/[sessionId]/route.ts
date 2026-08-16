// TARGET PATH: app/api/session-report/[sessionId]/route.ts
//
// Requires: npm install pdf-lib
//
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

const PAGE_WIDTH = 595.28; // A4
const PAGE_HEIGHT = 841.89;
const MARGIN = 50;
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN * 2;

function wrapText(text: string, font: PDFFont, size: number, maxWidth: number): string[] {
  const words = (text || "").split(/\s+/).filter(Boolean);
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
      page.drawText(text.toUpperCase(), {
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
      page.drawText(text, { x: MARGIN, y, size: 14, font: fontBold, color: INK });
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
      const lines = wrapText(text, font, size, CONTENT_WIDTH);
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
      page.drawText(label, {
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