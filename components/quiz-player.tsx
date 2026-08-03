"use client";

import { useState } from "react";
import { OptionCard } from "@/components/option-card";
import { ExplanationPanel } from "@/components/explanation-panel";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowRight, Loader2, Trophy, RotateCcw, ArrowLeft } from "lucide-react";
import type {
  QuizQuestionItem,
  AnswerResult,
  QuizResult,
} from "@/lib/quiz/types";
import { MusicTopbarButton } from "@/components/music/music-topbar-button";

interface QuizPlayerProps {
  attemptId: string;
  totalQuestions: number;
  initialQuestions: QuizQuestionItem[];
  quizId: string;
  subjectSlug: string;
  onRestartAttempt?: (
    newAttemptId: string,
    newTotal: number,
    newQuestions: QuizQuestionItem[]
  ) => void;
}

type Phase = "playing" | "result";

export function QuizPlayer({
  attemptId,
  totalQuestions: initialTotalQuestions,
  initialQuestions,
  quizId,
  subjectSlug,
  onRestartAttempt,
}: QuizPlayerProps) {
  const router = useRouter();
  const [currentIndex, setCurrentIndex] = useState(0);
  const [questions, setQuestions] = useState<QuizQuestionItem[]>(initialQuestions);
  const [totalQuestions, setTotalQuestions] = useState<number>(initialTotalQuestions);
  const [answersMap, setAnswersMap] = useState<Record<string, AnswerResult>>({});
  const [selectedMap, setSelectedMap] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [finishing, setFinishing] = useState(false);
  const [restarting, setRestarting] = useState(false);
  const [phase, setPhase] = useState<Phase>("playing");
  const [result, setResult] = useState<QuizResult | null>(null);
  const [error, setError] = useState("");

  const currentQ = questions[currentIndex];
  const position = currentIndex + 1;
  const currentSelectedOptionId = currentQ ? selectedMap[currentQ.questionId] || null : null;
  const currentAnswerResult = currentQ ? answersMap[currentQ.questionId] || null : null;
  const answered = !!currentAnswerResult;

  function handleSelectOption(optionId: string) {
    if (!currentQ || answered || submitting || restarting) return;
    setSelectedMap((prev) => ({
      ...prev,
      [currentQ.questionId]: optionId,
    }));
  }

  async function handleCheck() {
    if (!currentQ || !currentSelectedOptionId || submitting || answered || restarting) return;

    setSubmitting(true);
    setError("");

    try {
      const res = await fetch(`/api/attempts/${attemptId}/answer`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          questionId: currentQ.questionId,
          selectedOptionId: currentSelectedOptionId,
        }),
      });
      const data = await res.json();

      if (!res.ok || !data.ok) {
        setError(data.message || "Không thể gửi câu trả lời");
        setSubmitting(false);
        return;
      }

      setAnswersMap((prev) => ({
        ...prev,
        [currentQ.questionId]: data.data,
      }));
    } catch {
      setError("Mất kết nối. Vui lòng thử lại.");
    } finally {
      setSubmitting(false);
    }
  }

  function handleNext() {
    setError("");
    if (currentIndex >= questions.length - 1) {
      finishQuiz();
    } else {
      setCurrentIndex((prev) => prev + 1);
    }
  }

  async function finishQuiz() {
    setFinishing(true);
    setError("");
    try {
      const res = await fetch(`/api/attempts/${attemptId}/finish`, {
        method: "POST",
      });
      const data = await res.json();

      if (!res.ok || !data.ok) {
        setError(data.message || "Không thể hoàn tất bài làm");
        setFinishing(false);
        return;
      }

      setResult(data.data);
      setPhase("result");
    } catch {
      setError("Mất kết nối. Vui lòng thử lại.");
    } finally {
      setFinishing(false);
    }
  }

  async function handleRestartQuiz() {
    if (restarting) return;
    setRestarting(true);
    setError("");

    try {
      const res = await fetch(`/api/quizzes/${quizId}/start`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ forceNew: true }),
      });
      const data = await res.json();

      if (!res.ok || !data.ok) {
        setError("Không thể tạo lượt làm mới. Vui lòng thử lại.");
        setRestarting(false);
        return;
      }

      const newAttemptId = data.data.attemptId;
      const newTotal = data.data.totalQuestions || data.data.total;
      const newQuestions = data.data.questions || [];

      // Reset state
      setCurrentIndex(0);
      setQuestions(newQuestions);
      setTotalQuestions(newTotal);
      setAnswersMap({});
      setSelectedMap({});
      setPhase("playing");
      setResult(null);
      setError("");
      setSubmitting(false);
      setFinishing(false);

      // Replace URL
      router.replace(`/quiz/${quizId}?attempt=${newAttemptId}`, { scroll: false });

      // Trigger parent remount via key if provided
      if (onRestartAttempt) {
        onRestartAttempt(newAttemptId, newTotal, newQuestions);
      }
    } catch {
      setError("Không thể tạo lượt làm mới. Vui lòng thử lại.");
    } finally {
      setRestarting(false);
    }
  }

  if (phase === "result" && result) {
    const pct = result.score;
    const isGood = pct >= 70;

    return (
      <div className="flex min-h-screen flex-col bg-background">
        <header data-floating-obstacle="topbar" className="sticky top-0 z-40 border-b bg-card/80 backdrop-blur-sm">
          <div className="mx-auto flex max-w-2xl items-center justify-between px-4 py-3">
            <Link
              href={`/mon/${subjectSlug}`}
              className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
            >
              <ArrowLeft className="h-4 w-4" />
              <span>Quay về môn học</span>
            </Link>
            <MusicTopbarButton />
          </div>
        </header>
        <main className="flex flex-1 items-center justify-center px-4 py-8">
          <div className="w-full max-w-sm animate-fade-in text-center">
            <div
              className={`mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full ${
                isGood ? "bg-[hsl(var(--correct-bg))]" : "bg-[hsl(var(--incorrect-bg))]"
              }`}
            >
              <Trophy
                className={`h-10 w-10 ${
                  isGood ? "text-[hsl(var(--correct))]" : "text-[hsl(var(--incorrect))]"
                }`}
              />
            </div>
            <h2 className="mb-2 text-2xl font-bold text-foreground">
              Kết quả bài làm
            </h2>
            <p className="mb-1 text-4xl font-bold text-primary">{pct}%</p>
            <p className="mb-8 text-muted-foreground">
              {result.correctCount} / {result.totalQuestions} câu đúng
            </p>

            {error && (
              <div className="mb-4 rounded-lg bg-destructive/10 px-4 py-3 text-sm text-destructive">
                {error}
              </div>
            )}

            <div className="flex flex-col gap-3">
              <button
                onClick={handleRestartQuiz}
                disabled={restarting}
                className="flex w-full items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {restarting ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span>Đang tạo lượt mới...</span>
                  </>
                ) : (
                  <>
                    <RotateCcw className="h-4 w-4" />
                    <span>Làm lại quiz này</span>
                  </>
                )}
              </button>
              <Link
                href={`/mon/${subjectSlug}`}
                className="flex w-full items-center justify-center gap-2 rounded-lg border px-4 py-2.5 text-sm font-medium text-foreground transition-colors hover:bg-accent"
              >
                <ArrowLeft className="h-4 w-4" />
                Quay về môn học
              </Link>
            </div>
          </div>
        </main>
      </div>
    );
  }

  if (!currentQ) return null;

  return (
    <div className="min-h-screen bg-background">
      <header data-floating-obstacle="topbar" className="sticky top-0 z-40 border-b bg-card/80 backdrop-blur-sm">
        <div className="mx-auto flex max-w-2xl items-center justify-between px-4 py-3">
          <Link
            href={`/mon/${subjectSlug}`}
            className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" />
            <span className="hidden sm:inline">Quay lại</span>
          </Link>
          <div className="flex items-center gap-3">
            <span className="text-xs font-semibold text-muted-foreground">
              Câu {position} / {totalQuestions}
            </span>
            <MusicTopbarButton />
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-2xl px-4 py-6 animate-fade-in">
        {/* Progress bar */}
        <div className="mb-6">
          <div className="mb-2 flex items-center justify-between text-sm">
            <span className="font-medium text-foreground">
              Tiến độ bài làm
            </span>
            <span className="text-muted-foreground">
              {Math.round((position / totalQuestions) * 100)}%
            </span>
          </div>
          <div className="h-2 rounded-full bg-secondary">
            <div
              className="h-full rounded-full bg-primary transition-all duration-300"
              style={{ width: `${(position / totalQuestions) * 100}%` }}
            />
          </div>
        </div>

        {/* Question Text */}
        <div className="mb-6 rounded-xl border bg-card p-5 shadow-sm">
          <p className="text-base font-medium text-foreground leading-relaxed whitespace-pre-wrap">
            {currentQ.questionText}
          </p>
        </div>

        {/* Options */}
        <div className="mb-6 space-y-3">
          {currentQ.options.map((opt, idx) => {
            const optResult = currentAnswerResult?.options.find((o) => o.id === opt.id);
            return (
              <OptionCard
                key={opt.id}
                id={opt.id}
                text={opt.text}
                index={idx}
                selected={currentSelectedOptionId === opt.id}
                disabled={answered}
                result={optResult}
                isUserChoice={currentAnswerResult?.selectedOptionId === opt.id}
                isCorrectOption={currentAnswerResult?.correctOptionId === opt.id}
                onClick={handleSelectOption}
              />
            );
          })}
        </div>

        {/* General Explanation (after answered) */}
        {answered && currentAnswerResult && (
          <div className="mb-6">
            <ExplanationPanel generalExplanation={currentAnswerResult.generalExplanation} />
          </div>
        )}

        {/* Error notification */}
        {error && (
          <div className="mb-4 rounded-lg bg-destructive/10 px-4 py-3 text-sm text-destructive">
            {error}
          </div>
        )}

        {/* Bottom Actions */}
        <div data-floating-obstacle="quiz-action" className="pb-20">
          {!answered ? (
            <button
              onClick={handleCheck}
              disabled={!currentSelectedOptionId || submitting}
              className="w-full rounded-xl bg-primary px-4 py-3 text-sm font-medium text-primary-foreground shadow transition-all hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {submitting ? (
                <span className="flex items-center justify-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Đang kiểm tra...
                </span>
              ) : (
                "Kiểm tra"
              )}
            </button>
          ) : (
            <button
              onClick={handleNext}
              disabled={finishing}
              className="w-full rounded-xl bg-primary px-4 py-3 text-sm font-medium text-primary-foreground shadow transition-all hover:bg-primary/90 disabled:opacity-50"
            >
              {finishing ? (
                <span className="flex items-center justify-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Đang tính kết quả...
                </span>
              ) : currentIndex >= questions.length - 1 ? (
                <span className="flex items-center justify-center gap-2">
                  <Trophy className="h-4 w-4" />
                  Xem kết quả
                </span>
              ) : (
                <span className="flex items-center justify-center gap-2">
                  Câu tiếp theo
                  <ArrowRight className="h-4 w-4" />
                </span>
              )}
            </button>
          )}
        </div>
      </main>
    </div>
  );
}
