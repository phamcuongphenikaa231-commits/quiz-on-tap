"use client";

import { Lightbulb } from "lucide-react";

interface ExplanationPanelProps {
  generalExplanation: string;
}

export function ExplanationPanel({ generalExplanation }: ExplanationPanelProps) {
  if (!generalExplanation) return null;

  return (
    <div className="animate-slide-up rounded-xl border border-primary/20 bg-primary/5 p-4">
      <div className="mb-2 flex items-center gap-2 text-sm font-medium text-primary">
        <Lightbulb className="h-4 w-4" />
        Giải thích
      </div>
      <p className="text-sm text-foreground leading-relaxed whitespace-pre-wrap">
        {generalExplanation}
      </p>
    </div>
  );
}
