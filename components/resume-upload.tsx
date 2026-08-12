// TARGET PATH: components/resume-upload.tsx
"use client";

import { useState, useRef } from "react";
import { FileText, X, Loader2, AlertCircle, UploadCloud } from "lucide-react";
import { extractResumeText, truncateResumeText } from "@/lib/resume-parser";

interface ResumeUploadProps {
  onExtracted: (text: string) => void;
  onClear: () => void;
}

export function ResumeUpload({ onExtracted, onClear }: ResumeUploadProps) {
  const [fileName, setFileName] = useState<string | null>(null);
  const [extracting, setExtracting] = useState(false);
  const [error, setError] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  async function handleFile(file: File) {
    setError("");
    setExtracting(true);
    setFileName(file.name);

    try {
      const rawText = await extractResumeText(file);
      const truncated = truncateResumeText(rawText);
      onExtracted(truncated);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to read that file.";
      setError(message);
      setFileName(null);
    } finally {
      setExtracting(false);
    }
  }

  function handleClear() {
    setFileName(null);
    setError("");
    if (inputRef.current) inputRef.current.value = "";
    onClear();
  }

  return (
    <div className="space-y-2">
      <label className="label-mono">Resume (optional)</label>

      {!fileName ? (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          className="w-full border border-dashed border-border rounded-lg px-4 py-5 flex flex-col items-center gap-1.5 text-center hover:border-foreground/40 hover:bg-muted/40 transition-colors"
        >
          <UploadCloud className="h-5 w-5 text-muted-foreground" />
          <span className="text-sm text-foreground">
            Upload your resume to personalize your questions
          </span>
          <span className="label-mono">PDF, DOCX, or TXT</span>
        </button>
      ) : (
        <div className="w-full border border-border rounded-lg px-4 py-3 flex items-center gap-3">
          {extracting ? (
            <Loader2 className="h-4 w-4 shrink-0 animate-spin text-muted-foreground" />
          ) : (
            <FileText className="h-4 w-4 shrink-0 text-verified" />
          )}
          <span className="text-sm text-foreground truncate flex-1">{fileName}</span>
          {!extracting && (
            <button
              type="button"
              onClick={handleClear}
              title="Remove resume"
              className="p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors shrink-0"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
      )}

      <input
        ref={inputRef}
        type="file"
        accept=".pdf,.docx,.txt"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) handleFile(file);
        }}
      />

      {error && (
        <p className="flex items-center gap-1.5 text-sm text-destructive">
          <AlertCircle className="h-3.5 w-3.5 shrink-0" />
          {error}
        </p>
      )}

      <p className="label-mono text-muted-foreground/60">
        Your resume is read in your browser to generate questions — it's never
        uploaded or stored anywhere.
      </p>
    </div>
  );
}