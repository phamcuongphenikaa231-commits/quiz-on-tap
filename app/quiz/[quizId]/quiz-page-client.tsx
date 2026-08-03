"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { QuizPlayer } from "@/components/quiz-player";
import { Loader2, ArrowLeft } from "lucide-react";
import Link from "next/link";

interface QuizPageClientProps {
  quizId: string;
  subjectSlug: string;
}

export default function QuizPageClient({ quizId, subjectSlug }: QuizPageClientProps) {
  const [attemptId, setAttemptId] = useState<string | null>(null);
  const [totalQuestions, setTotalQuestions] = useState(0);
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

        setAttemptId(data.data.attemptId);
        setTotalQuestions(data.data.totalQuestions);
      } catch {
        setError("Mất kết nối. Vui lòng thử lại.");
      } finally {
        setLoading(false);
      }
    }

    startQuiz();
  }, [quizId, router]);

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

  if (!attemptId) return null;

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-40 border-b bg-card/80 backdrop-blur-sm">
        <div className="mx-auto flex max-w-2xl items-center px-4 py-3">
          <Link
            href={`/mon/${subjectSlug}`}
            className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" />
            <span className="hidden sm:inline">Quay lại</span>
          </Link>
        </div>
      </header>

      <QuizPlayer
        attemptId={attemptId}
        totalQuestions={totalQuestions}
        quizId={quizId}
        subjectSlug={subjectSlug}
      />
    </div>
  );
}
