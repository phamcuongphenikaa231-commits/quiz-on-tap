"use client";

import { useState } from "react";
import { ChevronDown, ChevronRight, FileQuestion } from "lucide-react";
import Link from "next/link";

interface Quiz {
  id: string;
  title: string;
  question_count: number;
}

interface Section {
  id: string;
  title: string;
  children: Section[];
  quizzes: Quiz[];
}

interface SectionTreeProps {
  sections: Section[];
  level?: number;
}

function SectionNode({ section, level = 0 }: { section: Section; level: number }) {
  const [open, setOpen] = useState(level === 0);
  const hasContent = section.children.length > 0 || section.quizzes.length > 0;

  return (
    <div className={level > 0 ? "ml-4 border-l border-border pl-4" : ""}>
      <button
        onClick={() => setOpen(!open)}
        className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm font-medium text-foreground transition-colors hover:bg-accent"
        disabled={!hasContent}
      >
        {hasContent ? (
          open ? (
            <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />
          ) : (
            <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
          )
        ) : (
          <span className="h-4 w-4 shrink-0" />
        )}
        <span>{section.title}</span>
      </button>

      {open && hasContent && (
        <div className="animate-fade-in">
          {/* Quizzes in this section */}
          {section.quizzes.map((quiz) => (
            <div
              key={quiz.id}
              className="ml-6 mt-1 flex items-center justify-between rounded-lg border bg-card px-4 py-3 shadow-sm transition-all hover:shadow"
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <FileQuestion className="h-4 w-4 shrink-0 text-primary" />
                <div className="min-w-0">
                  <p className="text-sm font-medium text-foreground truncate">
                    {quiz.title}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {quiz.question_count} câu
                  </p>
                </div>
              </div>
              <Link
                href={`/quiz/${quiz.id}`}
                className="shrink-0 rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground transition-colors hover:bg-primary/90"
              >
                Bắt đầu
              </Link>
            </div>
          ))}

          {/* Child sections */}
          {section.children.map((child) => (
            <SectionNode key={child.id} section={child} level={level + 1} />
          ))}
        </div>
      )}
    </div>
  );
}

export function SectionTree({ sections, level = 0 }: SectionTreeProps) {
  if (sections.length === 0) {
    return (
      <p className="py-8 text-center text-sm text-muted-foreground">
        Chưa có nội dung nào.
      </p>
    );
  }

  return (
    <div className="space-y-1">
      {sections.map((section) => (
        <SectionNode key={section.id} section={section} level={level} />
      ))}
    </div>
  );
}
