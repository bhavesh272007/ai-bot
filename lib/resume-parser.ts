// TARGET PATH: lib/resume-parser.ts
//
// Requires: npm install pdfjs-dist mammoth
//
// Extraction happens entirely in the browser — the raw file is never sent to
// the server. Only the extracted (and truncated) plain text is ever included
// in an API request, and it's never persisted to the database — it's used
// once to generate/personalize questions, then discarded.
"use client";

export async function extractResumeText(file: File): Promise<string> {
  const name = file.name.toLowerCase();

  if (name.endsWith(".txt")) {
    return await file.text();
  }

  if (name.endsWith(".pdf")) {
    return extractFromPdf(file);
  }

  if (name.endsWith(".docx")) {
    return extractFromDocx(file);
  }

  throw new Error("Unsupported file type. Please upload a PDF, DOCX, or TXT file.");
}

async function extractFromPdf(file: File): Promise<string> {
  const pdfjsLib = await import("pdfjs-dist");

  // Loaded from a CDN matching the installed package version — avoids
  // needing custom webpack config to bundle the worker file.
  pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.mjs`;

  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;

  let text = "";
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    text += content.items.map((item) => ("str" in item ? item.str : "")).join(" ") + "\n";
  }

  if (!text.trim()) {
    throw new Error(
      "Couldn't find any text in that PDF — it may be a scanned image. Try a text-based PDF, DOCX, or TXT file instead."
    );
  }

  return text;
}

async function extractFromDocx(file: File): Promise<string> {
  const mammoth = await import("mammoth");
  const arrayBuffer = await file.arrayBuffer();
  const result = await mammoth.extractRawText({ arrayBuffer });
  return result.value;
}

// Keeps prompt size (and Groq token usage) bounded — a resume only needs to
// supply enough context to ground question generation, not be reproduced.
export function truncateResumeText(text: string, maxChars = 4000): string {
  const trimmed = text.trim().replace(/[ \t]+/g, " ").replace(/\n{3,}/g, "\n\n");
  return trimmed.length > maxChars ? trimmed.slice(0, maxChars) + "\n...(truncated)" : trimmed;
}