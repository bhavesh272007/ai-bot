// TARGET PATH: components/interview/InterviewProgress.tsx
"use client";

import { Check, X } from "lucide-react";

interface NavQuestion {
  category: string;
  question: string;
}

interface NavAnswer {
  question: string;
  answer: string;
}

interface InterviewProgressProps {
  questions: NavQuestion[];
  currentIndex: number;
  isFollowUp: boolean;
  answers: NavAnswer[];
  onSelectReview: (index: number) => void;
}

// Sentinels written by handleNext/handleSkip in page.tsx for a question
// that was left blank or explicitly skipped — kept in one place so this
// component and page.tsx don't drift if that wording ever changes.
const SKIP_SENTINELS = ["(no answer given)", "(skipped by candidate)"];

// Live progress bar + per-question navigator shown during the interview.
// View-only by design: candidates can jump back to see what they answered,
// but the interview flow (handleNext/handleSkip) only ever moves forward,
// so re-answering a past question isn't offered here.
export function InterviewProgress({
  questions,
  currentIndex,
  isFollowUp,
  answers,
  onSelectReview,
}: InterviewProgressProps) {
  const total = questions.length;
  const percent =
    total === 0
      ? 0
      : Math.min(100, Math.round(((currentIndex + (isFollowUp ? 0.5 : 0)) / total) * 100));

  function answerFor(index: number) {
    return answers.find((a) => a.question === questions[index].question);
  }

  // "Answered" = has a recorded entry AND it's real content, not a
  // skip/blank sentinel. Skipped/blank questions still get a marker (and
  // are still reviewable) but never a checkmark.
  function status(index: number): "answered" | "skipped" | "unreached" {
    const entry = answerFor(index);
    if (!entry) return "unreached";
    return SKIP_SENTINELS.includes(entry.answer) ? "skipped" : "answered";
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="label-mono">
          Q{String(currentIndex + 1).padStart(2, "0")} / {String(total).padStart(2, "0")}
          {isFollowUp && " · follow-up"}
        </p>
        <p className="label-mono text-muted-foreground">{percent}% complete</p>
      </div>

      <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
        <div
          className="h-full rounded-full bg-seal transition-all duration-500"
          style={{ width: `${percent}%` }}
        />
      </div>

      <div className="flex items-center justify-center gap-1.5 flex-wrap pt-1">
        {questions.map((q, i) => {
          const questionStatus = status(i);
          const isCurrentMain = i === currentIndex && !isFollowUp;
          const isBeingFollowedUp = i === currentIndex && isFollowUp;
          const clickable = questionStatus !== "unreached";

          let classes =
            "relative h-6 w-6 rounded-full flex items-center justify-center text-[10px] font-mono border transition-colors ";

          if (isCurrentMain) {
            classes +=
              "border-foreground bg-muted text-foreground ring-2 ring-offset-1 ring-foreground ring-offset-background";
          } else if (isBeingFollowedUp) {
            classes +=
              "border-seal bg-seal text-background ring-2 ring-offset-1 ring-seal ring-offset-background animate-pulse";
          } else if (questionStatus === "answered") {
            classes += "border-seal bg-seal text-background hover:opacity-80 cursor-pointer";
          } else if (questionStatus === "skipped") {
            classes +=
              "border-destructive text-destructive bg-background hover:bg-destructive/10 cursor-pointer";
          } else {
            classes += "border-border text-muted-foreground cursor-default";
          }

          const showCheck = questionStatus === "answered" && !isCurrentMain && !isBeingFollowedUp;
          const showX = questionStatus === "skipped" && !isCurrentMain && !isBeingFollowedUp;

          return (
            <button
              key={i}
              type="button"
              disabled={!clickable}
              onClick={() => clickable && onSelectReview(i)}
              title={
                questionStatus === "answered"
                  ? `Review your answer to Q${i + 1}`
                  : questionStatus === "skipped"
                  ? `Q${i + 1} was skipped — click to review`
                  : isCurrentMain
                  ? "Current question"
                  : `Question ${i + 1} — not reached yet`
              }
              className={classes}
            >
              {showCheck ? (
                <Check className="h-3 w-3" />
              ) : showX ? (
                <X className="h-3 w-3" />
              ) : (
                i + 1
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}