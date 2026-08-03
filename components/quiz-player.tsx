"use client";

import { useState, useCallback } from "react";
import { OptionCard } from "@/components/option-card";
import { ExplanationPanel } from "@/components/explanation-panel";
import { useRouter } from "next/navigation";
import { ArrowRight, Loader2, Trophy, RotateCcw, ArrowLeft } from "lucide-react";
import type {
  QuizQuestion,
  AnswerResult,
  QuizResult,
} from "@/lib/quiz/types";

interface QuizPlayerProps {
  attemptId: string;
  totalQuestions: number;
  quizId: string;
  subjectSlug: string;
}

type Phase = "playing" | "result";

export function QuizPlayer({
  attemptId,
  totalQuestions,
  quizId,
  subjectSlug,
}: QuizPlayerProps) {
  const router = useRouter();
  const [position, setPosition] = useState(1);
  const [question, setQuestion] = useState<QuizQuestion | null>(null);
  const [selectedOptionId, setSelectedOptionId] = useState<string | null>(null);
  const [answerResult, setAnswerResult] = useState<AnswerResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [phase, setPhase] = useState<Phase>("playing");
  const [result, setResult] = useState<QuizResult | null>(null);
  const [error, setError] = useState("");

  const fetchQuestion = useCallback(
    async (pos: number) => {
      setLoading(true);
      setSelectedOptionId(null);
      setAnswerResult(null);
      setError("");

      try {
        const res = await fetch(
          `/api/attempts/${attemptId}/question/${pos}`
        );
        const data = await res.json();

        if (!res.ok || !data.ok) {
          setError(data.message || "Không thể tải câu hỏi");
          setLoading(false);
          return;
        }

        setQuestion(data.data);
      } catch {
        setError("Mất kết nối. Vui lòng thử lại.");
      } finally {
        setLoading(false);
      }
    },
    [attemptId]
  );

  // Load first question
  useState(() => {
    fetchQuestion(1);
  });

  async function handleCheck() {
    if (!selectedOptionId || !question || submitting) return;

    setSubmitting(true);
    setError("");

    try {
      const res = await fetch(`/api/attempts/${attemptId}/answer`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          questionId: question.questionId,
          selectedOptionId,
        }),
      });
      const data = await res.json();

      if (!res.ok || !data.ok) {
        setError(data.message || "Không thể gửi câu trả lời");
        setSubmitting(false);
        return;
      }

      setAnswerResult(data.data);
    } catch {
      setError("Mất kết nối. Vui lòng thử lại.");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleNext() {
    if (position >= totalQuestions) {
      // Finish quiz
      await finishQuiz();
    } else {
      const nextPos = position + 1;
      setPosition(nextPos);
      await fetchQuestion(nextPos);
    }
  }

  async function finishQuiz() {
    setLoading(true);
    try {
      const res = await fetch(`/api/attempts/${attemptId}/finish`, {
        method: "POST",
      });
      const data = await res.json();

      if (!res.ok || !data.ok) {
        setError(data.message || "Không thể hoàn tất bài làm");
        setLoading(false);
        return;
      }

      setResult(data.data);
      setPhase("result");
    } catch {
      setError("Mất kết nối. Vui lòng thử lại.");
    } finally {
      setLoading(false);
    }
  }

  // Result screen
  if (phase === "result" && result) {
    const pct = result.score;
    const isGood = pct >= 70;

    return (
      <div className="flex min-h-[60vh] items-center justify-center px-4">
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
            Kết quả
          </h2>
          <p className="mb-1 text-4xl font-bold text-primary">{pct}%</p>
          <p className="mb-8 text-muted-foreground">
            {result.correctCount} / {result.totalQuestions} câu đúng
          </p>

          <div className="flex flex-col gap-3">
            <button
              onClick={() => {
                // Restart quiz
                router.push(`/quiz/${quizId}`);
                router.refresh();
              }}
              className="flex w-full items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
            >
              <RotateCcw className="h-4 w-4" />
              Làm lại
            </button>
            <button
              onClick={() => router.push(`/mon/${subjectSlug}`)}
              className="flex w-full items-center justify-center gap-2 rounded-lg border px-4 py-2.5 text-sm font-medium text-foreground transition-colors hover:bg-accent"
            >
              <ArrowLeft className="h-4 w-4" />
              Quay về môn học
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Loading
  if (loading && !question) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  // Error
  if (error && !question) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center px-4">
        <div className="text-center">
          <p className="mb-4 text-destructive">{error}</p>
          <button
            onClick={() => fetchQuestion(position)}
            className="rounded-lg bg-primary px-4 py-2 text-sm text-primary-foreground"
          >
            Thử lại
          </button>
        </div>
      </div>
    );
  }

  if (!question) return null;

  const answered = !!answerResult;

  return (
    <div className="mx-auto max-w-2xl px-4 py-6 animate-fade-in">
      {/* Progress */}
      <div className="mb-6">
        <div className="mb-2 flex items-center justify-between text-sm">
          <span className="font-medium text-foreground">
            Câu {position} / {totalQuestions}
          </span>
          <span className="text-muted-foreground">
            {Math.round((position / totalQuestions) * 100)}%
          </span>
        </div>
        <div className="h-2 rounded-full bg-secondary">
          <div
            className="h-full rounded-full bg-primary transition-all duration-500"
            style={{ width: `${(position / totalQuestions) * 100}%` }}
          />
        </div>
      </div>

      {/* Question */}
      <div className="mb-6 rounded-xl border bg-card p-5 shadow-sm">
        <p className="text-base font-medium text-foreground leading-relaxed whitespace-pre-wrap">
          {question.questionText}
        </p>
      </div>

      {/* Options */}
      <div className="mb-6 space-y-3">
        {question.options.map((opt, idx) => {
          const optResult = answerResult?.options.find((o) => o.id === opt.id);
          return (
            <OptionCard
              key={opt.id}
              id={opt.id}
              text={opt.text}
              index={idx}
              selected={selectedOptionId === opt.id}
              disabled={answered}
              result={optResult}
              isUserChoice={answerResult?.selectedOptionId === opt.id}
              isCorrectOption={answerResult?.correctOptionId === opt.id}
              onClick={setSelectedOptionId}
            />
          );
        })}
      </div>

      {/* Explanation (after answering) */}
      {answered && answerResult && (
        <div className="mb-6">
          <ExplanationPanel generalExplanation={answerResult.generalExplanation} />
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="mb-4 rounded-lg bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      )}

      {/* Actions */}
      <div className="pb-20">
        {!answered ? (
          <button
            onClick={handleCheck}
            disabled={!selectedOptionId || submitting}
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
            disabled={loading}
            className="w-full rounded-xl bg-primary px-4 py-3 text-sm font-medium text-primary-foreground shadow transition-all hover:bg-primary/90 disabled:opacity-50"
          >
            {loading ? (
              <Loader2 className="mx-auto h-4 w-4 animate-spin" />
            ) : position >= totalQuestions ? (
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
    </div>
  );
}
