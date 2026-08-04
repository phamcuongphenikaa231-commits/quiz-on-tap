"use client";

import { useState, useEffect, useCallback } from "react";
import { Search, Edit3, Trash2, Loader2, X } from "lucide-react";

export interface QuestionOption {
  id?: string;
  option_text: string;
  explanation: string;
  is_correct: boolean;
  sort_order: number;
}

export interface QuestionRecord {
  id: string;
  quiz_id: string;
  question_text: string;
  hint?: string;
  sort_order: number;
  options: QuestionOption[];
}

interface QuizQuestionsManagerProps {
  quizId: string;
  quizTitle: string;
  onQuestionsUpdated?: () => void;
}

export function QuizQuestionsManager({
  quizId,
  quizTitle,
  onQuestionsUpdated,
}: QuizQuestionsManagerProps) {
  const [questions, setQuestions] = useState<QuestionRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [editingQuestion, setEditingQuestion] = useState<QuestionRecord | null>(null);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // Form edit states
  const [editQuestionText, setEditQuestionText] = useState("");
  const [editHint, setEditHint] = useState("");
  const [editSortOrder, setEditSortOrder] = useState<number>(1);
  const [editOptions, setEditOptions] = useState<
    Array<{ text: string; explanation: string; isCorrect: boolean }>
  >([
    { text: "", explanation: "", isCorrect: true },
    { text: "", explanation: "", isCorrect: false },
    { text: "", explanation: "", isCorrect: false },
    { text: "", explanation: "", isCorrect: false },
  ]);

  const fetchQuestions = useCallback(async () => {
    if (!quizId) return;
    setLoading(true);
    try {
      const query = search ? `?search=${encodeURIComponent(search)}` : "";
      const res = await fetch(`/api/admin/quizzes/${quizId}/questions${query}`);
      const data = await res.json();
      if (res.ok && data.ok) {
        setQuestions(data.data);
      }
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, [quizId, search]);

  useEffect(() => {
    fetchQuestions();
  }, [fetchQuestions]);

  function openEditModal(q: QuestionRecord) {
    setEditingQuestion(q);
    setEditQuestionText(q.question_text);
    setEditHint(q.hint || "");
    setEditSortOrder(q.sort_order);

    const sortedOpts = [...(q.options || [])].sort((a, b) => a.sort_order - b.sort_order);
    const opts = [0, 1, 2, 3].map((idx) => {
      const item = sortedOpts[idx];
      return {
        text: item ? item.option_text : "",
        explanation: item ? item.explanation : "",
        isCorrect: item ? item.is_correct : idx === 0,
      };
    });
    setEditOptions(opts);
  }

  async function handleSaveEdit(e: React.FormEvent) {
    e.preventDefault();
    if (!editingQuestion || saving) return;

    // Ensure 1 correct
    const correctCount = editOptions.filter((o) => o.isCorrect).length;
    if (correctCount !== 1) {
      alert("Phải chọn đúng 1 đáp án đúng!");
      return;
    }

    setSaving(true);
    try {
      const payload = {
        questionText: editQuestionText,
        hint: editHint,
        sortOrder: editSortOrder,
        options: editOptions.map((opt, idx) => ({
          text: opt.text,
          explanation: opt.explanation,
          isCorrect: opt.isCorrect,
          sortOrder: idx + 1,
        })),
      };

      const res = await fetch(`/api/admin/questions/${editingQuestion.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok || !data.ok) {
        alert(data.message || "Không thể lưu câu hỏi");
        return;
      }

      setEditingQuestion(null);
      fetchQuestions();
      onQuestionsUpdated?.();
    } catch {
      alert("Lỗi kết nối máy chủ");
    } fontally: {
      setSaving(false);
    }
  }

  async function handleDelete(qId: string) {
    if (!confirm("Bạn có chắc chắn muốn xóa câu hỏi này?")) return;
    setDeletingId(qId);
    try {
      const res = await fetch(`/api/admin/questions/${qId}`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (res.ok && data.ok) {
        fetchQuestions();
        onQuestionsUpdated?.();
      } else {
        alert(data.message || "Xóa câu hỏi thất bại");
      }
    } catch {
      alert("Lỗi máy chủ khi xóa");
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <div className="space-y-4 rounded-xl border bg-card p-5 shadow-sm">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h3 className="font-bold text-base text-foreground">
            Danh sách câu hỏi của quiz: &quot;{quizTitle}&quot;
          </h3>
          <p className="text-xs text-muted-foreground">
            Tổng số câu hiện tại: {questions.length} câu
          </p>
        </div>

        {/* Search */}
        <div className="relative w-full sm:w-64">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="Tìm kiếm từ khóa câu hỏi..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-lg border bg-background pl-8 pr-3 py-1.5 text-xs outline-none focus:ring-2 focus:ring-primary/20"
          />
        </div>
      </div>

      {/* List */}
      {loading ? (
        <div className="flex py-10 justify-center items-center gap-2 text-muted-foreground text-sm">
          <Loader2 className="h-5 w-5 animate-spin text-primary" />
          <span>Đang tải danh sách câu hỏi...</span>
        </div>
      ) : questions.length === 0 ? (
        <div className="p-8 text-center text-sm text-muted-foreground border border-dashed rounded-lg">
          {search ? "Không tìm thấy câu hỏi phù hợp." : "Quiz này chưa có câu hỏi nào."}
        </div>
      ) : (
        <div className="space-y-3">
          {questions.map((q, idx) => (
            <div
              key={q.id}
              className="rounded-lg border p-4 hover:border-primary/40 transition-colors space-y-2 bg-background"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-2">
                  <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">
                    {q.sort_order || idx + 1}
                  </span>
                  <p className="font-medium text-sm text-foreground">{q.question_text}</p>
                </div>

                <div className="flex items-center gap-1 shrink-0">
                  <button
                    type="button"
                    onClick={() => openEditModal(q)}
                    className="p-1.5 rounded-lg text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
                    title="Chỉnh sửa câu hỏi"
                  >
                    <Edit3 className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDelete(q.id)}
                    disabled={deletingId === q.id}
                    className="p-1.5 rounded-lg text-muted-foreground hover:bg-red-50 hover:text-red-600 transition-colors"
                    title="Xóa câu hỏi"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>

              {/* Options */}
              <div className="grid gap-1.5 sm:grid-cols-2 pt-1">
                {(q.options || []).map((opt, oIdx) => (
                  <div
                    key={opt.id || oIdx}
                    className={`rounded px-2.5 py-1.5 text-xs ${
                      opt.is_correct
                        ? "bg-emerald-50 text-emerald-900 font-semibold border border-emerald-200"
                        : "bg-muted/40 text-muted-foreground"
                    }`}
                  >
                    <span className="font-bold mr-1">
                      {["A", "B", "C", "D"][oIdx]}.
                    </span>
                    {opt.option_text}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Edit Modal */}
      {editingQuestion && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-xl rounded-2xl bg-card p-6 shadow-xl max-h-[90vh] overflow-y-auto border animate-fade-in space-y-4">
            <div className="flex items-center justify-between border-b pb-3">
              <h3 className="font-bold text-base text-foreground">
                Chỉnh sửa câu hỏi (ID: {editingQuestion.id.slice(0, 8)})
              </h3>
              <button
                onClick={() => setEditingQuestion(null)}
                className="text-muted-foreground hover:text-foreground"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleSaveEdit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-foreground mb-1">
                  Nội dung câu hỏi
                </label>
                <textarea
                  rows={3}
                  required
                  value={editQuestionText}
                  onChange={(e) => setEditQuestionText(e.target.value)}
                  className="w-full rounded-lg border bg-background px-3 py-2 text-xs outline-none focus:ring-2 focus:ring-primary/20"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-foreground mb-1">
                  Gợi ý (Hint)
                </label>
                <textarea
                  rows={2}
                  maxLength={1000}
                  placeholder="Nhập một gợi ý giúp người học suy luận nhưng không tiết lộ trực tiếp đáp án..."
                  value={editHint}
                  onChange={(e) => setEditHint(e.target.value)}
                  className="w-full rounded-lg border bg-background px-3 py-2 text-xs outline-none focus:ring-2 focus:ring-primary/20"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-foreground mb-1">
                  Thứ tự (sort_order)
                </label>
                <input
                  type="number"
                  value={editSortOrder}
                  onChange={(e) => setEditSortOrder(parseInt(e.target.value, 10) || 1)}
                  className="w-24 rounded-lg border bg-background px-3 py-1.5 text-xs outline-none focus:ring-2 focus:ring-primary/20"
                />
              </div>

              {/* 4 Options */}
              <div className="space-y-3 pt-2">
                <h4 className="text-xs font-bold text-foreground uppercase border-b pb-1">
                  4 Phương án & Lời giải thích riêng
                </h4>

                {editOptions.map((opt, idx) => (
                  <div key={idx} className="rounded-lg border bg-muted/20 p-3 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-xs text-primary">
                        Phương án {["A", "B", "C", "D"][idx]}
                      </span>
                      <label className="flex items-center gap-1.5 text-xs font-semibold cursor-pointer">
                        <input
                          type="radio"
                          name="correctOptionRadio"
                          checked={opt.isCorrect}
                          onChange={() => {
                            setEditOptions((prev) =>
                              prev.map((item, i) => ({
                                ...item,
                                isCorrect: i === idx,
                              }))
                            );
                          }}
                          className="h-3.5 w-3.5 text-emerald-600"
                        />
                        <span className={opt.isCorrect ? "text-emerald-600 font-bold" : "text-muted-foreground"}>
                          Đáp án đúng
                        </span>
                      </label>
                    </div>

                    <input
                      type="text"
                      required
                      placeholder={`Nội dung phương án ${["A", "B", "C", "D"][idx]}`}
                      value={opt.text}
                      onChange={(e) => {
                        const val = e.target.value;
                        setEditOptions((prev) =>
                          prev.map((item, i) => (i === idx ? { ...item, text: val } : item))
                        );
                      }}
                      className="w-full rounded-lg border bg-background px-3 py-1.5 text-xs outline-none focus:ring-2 focus:ring-primary/20"
                    />

                    <input
                      type="text"
                      required
                      placeholder={`Giải thích cho phương án ${["A", "B", "C", "D"][idx]}`}
                      value={opt.explanation}
                      onChange={(e) => {
                        const val = e.target.value;
                        setEditOptions((prev) =>
                          prev.map((item, i) => (i === idx ? { ...item, explanation: val } : item))
                        );
                      }}
                      className="w-full rounded-lg border bg-background px-3 py-1.5 text-xs outline-none focus:ring-2 focus:ring-primary/20"
                    />
                  </div>
                ))}
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t">
                <button
                  type="button"
                  onClick={() => setEditingQuestion(null)}
                  className="rounded-lg border px-4 py-2 text-xs font-medium text-foreground hover:bg-accent"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="rounded-lg bg-primary px-5 py-2 text-xs font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
                >
                  {saving ? "Đang lưu..." : "Lưu thay đổi"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
