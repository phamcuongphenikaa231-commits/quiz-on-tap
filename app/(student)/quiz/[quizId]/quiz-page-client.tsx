"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { QuizPlayer } from "@/components/quiz-player";
import { Loader2 } from "lucide-react";
import Link from "next/link";
import type { QuizQuestionItem } from "@/lib/quiz/types";

interface QuizPageClientProps {
  quizId: string;
  subjectSlug: string;
}

export default function QuizPageClient({ quizId, subjectSlug }: QuizPageClientProps) {
  const [attemptId, setAttemptId] = useState<string | null>(null);
  const [totalQuestions, setTotalQuestions] = useState(0);
  const [questions, setQuestions] = useState<QuizQuestionItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const router = useRouter();

  useEffect(() => {
    async function startQuiz() {
      setLoading(true);
      setError("");

      try {
        const res = await fetch(`/api/quizzes/${quizId}/start`, {
          method: "POST",
        });
        const data = await res.json();

        if (!res.ok || !data.ok) {
          const code = data.code;
          if (code === "DEVICE_INACTIVE") {
            router.push("/device-limit");
            return;
          }
          setError(data.message || "Không thể bắt đầu quiz");
          setLoading(false);
          return;
        }

        const attemptData = data.data;
        setAttemptId(attemptData.attemptId);
        setTotalQuestions(attemptData.totalQuestions || attemptData.total);
        setQuestions(attemptData.questions || []);
      } catch {
        setError("Mất kết nối. Vui lòng thử lại.");
      } finally {
        setLoading(false);
      }
    }

    startQuiz();
  }, [quizId, router]);

  function handleRestartAttempt(newAttemptId: string, newTotal: number, newQuestions: QuizQuestionItem[]) {
    setAttemptId(newAttemptId);
    setTotalQuestions(newTotal);
    setQuestions(newQuestions);
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-center">
          <Loader2 className="mx-auto mb-3 h-8 w-8 animate-spin text-primary" />
          <p className="text-sm text-muted-foreground">Đang tải quiz...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex min-h-screen items-center justify-center px-4">
        <div className="w-full max-w-sm text-center">
          <p className="mb-4 text-destructive">{error}</p>
          <div className="flex flex-col gap-2">
            <button
              onClick={() => window.location.reload()}
              className="rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground"
            >
              Thử lại
            </button>
            <Link
              href={`/mon/${subjectSlug}`}
              className="rounded-lg border px-4 py-2.5 text-sm font-medium text-foreground hover:bg-accent"
            >
              Quay lại
            </Link>
          </div>
        </div>
      </div>
    );
  }

  if (!attemptId || questions.length === 0) return null;

  return (
    <div className="min-h-screen bg-background">
      <QuizPlayer
        key={attemptId}
        attemptId={attemptId}
        totalQuestions={totalQuestions}
        initialQuestions={questions}
        quizId={quizId}
        subjectSlug={subjectSlug}
        onRestartAttempt={handleRestartAttempt}
      />
    </div>
  );
}
