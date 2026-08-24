// TARGET PATH: components/resume-upload.tsx
"use client";

import { useState, useRef } from "react";
import { FileText, X, Loader2, AlertCircle, UploadCloud } from "lucide-react";
import { extractResumeText, truncateResumeText } from "@/lib/resume-parser";
import styles from "./resume-upload.module.css";

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
    <div className={styles.wrap}>
      <label className={styles.label}>Resume (optional)</label>

      {!fileName ? (
        <button type="button" onClick={() => inputRef.current?.click()} className={styles.dropzone}>
          <UploadCloud size={20} className={styles.dropzoneIcon} />
          <span className={styles.dropzoneText}>
            Upload your resume to personalize your questions
          </span>
          <span className={styles.dropzoneHint}>PDF, DOCX, or TXT</span>
        </button>
      ) : (
        <div className={styles.fileRow}>
          {extracting ? (
            <Loader2 size={16} className={styles.fileSpinner} />
          ) : (
            <FileText size={16} className={styles.fileIconOk} />
          )}
          <span className={styles.fileName}>{fileName}</span>
          {!extracting && (
            <button type="button" onClick={handleClear} title="Remove resume" className={styles.removeBtn}>
              <X size={16} />
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
        <p className={styles.errorMsg}>
          <AlertCircle size={14} />
          {error}
        </p>
      )}

      <p className={styles.privacyNote}>
        Your resume is read in your browser to generate questions — it&apos;s never
        uploaded or stored anywhere.
      </p>
    </div>
  );
}