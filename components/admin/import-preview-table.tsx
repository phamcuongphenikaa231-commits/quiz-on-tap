"use client";

import { useState } from "react";
import { QuestionInput } from "@/lib/import/question-schema";
import {
  CheckCircle2,
  AlertTriangle,
  RotateCcw,
  Upload,
  Loader2,
} from "lucide-react";

interface ImportPreviewTableProps {
  quizTitle: string;
  existingQuestionCount: number;
  questions: QuestionInput[];
  replaceExisting: boolean;
  onChangeReplaceExisting: (replace: boolean) => void;
  onReset: () => void;
  onCommit: () => void;
  loading: boolean;
}

export function ImportPreviewTable({
  quizTitle,
  existingQuestionCount,
  questions,
  replaceExisting,
  onChangeReplaceExisting,
  onReset,
  onCommit,
  loading,
}: ImportPreviewTableProps) {
  const [confirmedReplace, setConfirmedReplace] = useState(false);

  const previewQuestions = questions.slice(0, 10);

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header Summary Banner */}
      <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-emerald-900 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <CheckCircle2 className="h-6 w-6 text-emerald-600 shrink-0" />
          <div>
            <h3 className="font-bold text-base">
              Đã kiểm tra thành công {questions.length} câu hỏi hợp lệ
            </h3>
            <p className="text-xs text-emerald-700">
              Quiz đích: <strong className="font-semibold text-emerald-950">&quot;{quizTitle}&quot;</strong>
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={onReset}
          className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-300 bg-white px-3 py-1.5 text-xs font-semibold text-emerald-800 hover:bg-emerald-100 transition-colors shrink-0"
        >
          <RotateCcw className="h-4 w-4" />
          Chọn file / dữ liệu khác
        </button>
      </div>

      {/* Warning if existing questions exist */}
      {existingQuestionCount > 0 && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-amber-900 text-sm flex items-start gap-3">
          <AlertTriangle className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
          <div>
            <p className="font-bold">
              Chú ý: Quiz này hiện đang có {existingQuestionCount} câu hỏi trong hệ thống!
            </p>
            <p className="text-xs text-amber-800 mt-0.5">
              Vui lòng chọn chế độ nhập ở bên dưới trước khi bấm &quot;Nhập câu hỏi&quot;.
            </p>
          </div>
        </div>
      )}

      {/* Preview Table */}
      <div className="rounded-xl border bg-card shadow-sm overflow-hidden space-y-3">
        <div className="p-4 border-b bg-muted/40 flex items-center justify-between">
          <h4 className="font-bold text-sm text-foreground">
            Bản xem trước (Hiển thị {previewQuestions.length} / {questions.length} câu đầu tiên)
          </h4>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-muted/50 text-muted-foreground font-semibold uppercase border-b">
              <tr>
                <th className="px-3 py-2 w-12 text-center">STT</th>
                <th className="px-4 py-2">Nội dung câu hỏi</th>
                <th className="px-4 py-2">Đáp án đúng</th>
                <th className="px-4 py-2">Lời giải thích chung</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {previewQuestions.map((q, idx) => {
                const correctOpt = q.options.find((o) => o.isCorrect);
                const optLetter = correctOpt
                  ? ["A", "B", "C", "D"][correctOpt.sortOrder ? correctOpt.sortOrder - 1 : q.options.indexOf(correctOpt)]
                  : "?";

                return (
                  <tr key={idx} className="hover:bg-accent/40 transition-colors">
                    <td className="px-3 py-3 text-center font-medium text-muted-foreground">
                      {q.sortOrder ?? idx + 1}
                    </td>
                    <td className="px-4 py-3 font-medium text-foreground max-w-xs truncate">
                      {q.questionText}
                    </td>
                    <td className="px-4 py-3">
                      <span className="inline-flex items-center gap-1 rounded bg-emerald-100 px-2 py-0.5 font-bold text-emerald-800">
                        {optLetter}. {correctOpt?.text}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground max-w-xs truncate">
                      {q.generalExplanation}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Mode Selection & Confirmation */}
      <div className="rounded-xl border bg-card p-5 shadow-sm space-y-4">
        <h4 className="font-bold text-sm text-foreground">Chế độ nhập vào Database</h4>

        <div className="grid gap-3 sm:grid-cols-2">
          <label
            className={`flex items-start gap-3 rounded-xl border p-4 cursor-pointer transition-colors ${
              replaceExisting
                ? "border-primary bg-primary/5 ring-1 ring-primary"
                : "border-border hover:bg-accent/40"
            }`}
          >
            <input
              type="radio"
              name="importMode"
              checked={replaceExisting}
              onChange={() => onChangeReplaceExisting(true)}
              className="mt-1 h-4 w-4 text-primary"
            />
            <div>
              <p className="font-bold text-sm text-foreground">Xóa câu cũ và nhập lại (Khuyến nghị)</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                Xóa toàn bộ {existingQuestionCount} câu hỏi cũ trong quiz này và thay bằng {questions.length} câu mới.
              </p>
            </div>
          </label>

          <label
            className={`flex items-start gap-3 rounded-xl border p-4 cursor-pointer transition-colors ${
              !replaceExisting
                ? "border-primary bg-primary/5 ring-1 ring-primary"
                : "border-border hover:bg-accent/40"
            }`}
          >
            <input
              type="radio"
              name="importMode"
              checked={!replaceExisting}
              onChange={() => onChangeReplaceExisting(false)}
              className="mt-1 h-4 w-4 text-primary"
            />
            <div>
              <p className="font-bold text-sm text-foreground">Nối thêm vào cuối</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                Giữ nguyên các câu hỏi cũ và thêm {questions.length} câu mới vào đằng sau.
              </p>
            </div>
          </label>
        </div>

        {/* Confirmation Checkbox for Replace Mode */}
        {replaceExisting && existingQuestionCount > 0 && (
          <div className="rounded-lg bg-red-50 p-3 border border-red-200 text-red-900 text-xs flex items-center gap-2">
            <input
              type="checkbox"
              id="confirmReplace"
              checked={confirmedReplace}
              onChange={(e) => setConfirmedReplace(e.target.checked)}
              className="h-4 w-4 rounded border-red-300 text-destructive focus:ring-destructive"
            />
            <label htmlFor="confirmReplace" className="font-medium cursor-pointer">
              Tôi hiểu toàn bộ câu hỏi cũ trong quiz này sẽ bị thay thế.
            </label>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex items-center justify-between pt-2 border-t">
          <button
            type="button"
            onClick={onReset}
            className="rounded-lg border px-4 py-2 text-sm font-medium text-foreground hover:bg-accent"
          >
            Chọn file khác
          </button>

          <button
            type="button"
            onClick={onCommit}
            disabled={loading || (replaceExisting && existingQuestionCount > 0 && !confirmedReplace)}
            className="flex items-center gap-2 rounded-lg bg-emerald-600 px-6 py-2.5 text-sm font-bold text-white shadow hover:bg-emerald-700 transition-colors disabled:opacity-50"
          >
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Đang nhập vào database...
              </>
            ) : (
              <>
                <Upload className="h-4 w-4" />
                Nhập câu hỏi
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
