"use client";

import { cn } from "@/lib/utils";
import type { AnswerOptionResult } from "@/lib/quiz/types";

interface OptionCardProps {
  id: string;
  text: string;
  index: number;
  selected: boolean;
  disabled: boolean;
  // After answering
  result?: AnswerOptionResult;
  isUserChoice: boolean;
  isCorrectOption: boolean;
  onClick: (id: string) => void;
}

const LABELS = ["A", "B", "C", "D", "E", "F", "G", "H"];

export function OptionCard({
  id,
  text,
  index,
  selected,
  disabled,
  result,
  isUserChoice,
  isCorrectOption,
  onClick,
}: OptionCardProps) {
  const hasResult = !!result;

  let bgClass = "bg-card hover:bg-accent/50";
  let borderClass = "border-border";

  if (hasResult) {
    if (isCorrectOption) {
      bgClass = "bg-[hsl(var(--correct-bg))]";
      borderClass = "border-[hsl(var(--correct-border))]";
    } else if (isUserChoice && !result.isCorrect) {
      bgClass = "bg-[hsl(var(--incorrect-bg))]";
      borderClass = "border-[hsl(var(--incorrect-border))]";
    } else {
      bgClass = "bg-card";
      borderClass = "border-border";
    }
  } else if (selected) {
    bgClass = "bg-primary/5";
    borderClass = "border-primary";
  }

  return (
    <button
      type="button"
      disabled={disabled}
      onClick={() => !disabled && onClick(id)}
      className={cn(
        "w-full rounded-xl border-2 p-4 text-left transition-all",
        bgClass,
        borderClass,
        !disabled && !hasResult && "cursor-pointer active:scale-[0.98]",
        disabled && "cursor-default"
      )}
    >
      <div className="flex items-start gap-3">
        <span
          className={cn(
            "flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold",
            hasResult && isCorrectOption
              ? "bg-[hsl(var(--correct))] text-white"
              : hasResult && isUserChoice && !result?.isCorrect
                ? "bg-[hsl(var(--incorrect))] text-white"
                : selected
                  ? "bg-primary text-primary-foreground"
                  : "bg-secondary text-secondary-foreground"
          )}
        >
          {LABELS[index] || index + 1}
        </span>
        <span className="text-sm text-foreground leading-relaxed pt-0.5">
          {text}
        </span>
      </div>

      {/* Explanation per option - shown after answering */}
      {hasResult && result?.explanation && (
        <div className="mt-3 ml-10 rounded-lg bg-background/60 px-3 py-2 text-xs text-muted-foreground leading-relaxed">
          {result.explanation}
        </div>
      )}
    </button>
  );
}
