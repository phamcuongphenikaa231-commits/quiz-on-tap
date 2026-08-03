"use client";

import { useState, useEffect, useCallback, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { ImportFileForm, SubjectItem, SectionItem, QuizItem } from "@/components/admin/import-file-form";
import { ImportPreviewTable } from "@/components/admin/import-preview-table";
import { ImportErrorList, RowErrorItem } from "@/components/admin/import-error-list";
import { QuizQuestionsManager } from "@/components/admin/quiz-questions-manager";
import { QuestionInput } from "@/lib/import/question-schema";
import { CheckCircle2, ExternalLink, Loader2, Sparkles, RefreshCw } from "lucide-react";
import Link from "next/link";

function ImportPageContent() {
  const searchParams = useSearchParams();
  const paramQuizId = searchParams.get("quizId") || "";

  // Tree state
  const [subjects, setSubjects] = useState<SubjectItem[]>([]);
  const [sections, setSections] = useState<SectionItem[]>([]);
  const [quizzes, setQuizzes] = useState<QuizItem[]>([]);
  const [loadingTree, setLoadingTree] = useState(true);

  // Form & Tab State
  const [selectedQuizId, setSelectedQuizId] = useState(paramQuizId);
  const [activeTab, setActiveTab] = useState<"file" | "json">("file");
  const [file, setFile] = useState<File | null>(null);
  const [jsonText, setJsonText] = useState("");

  // Preview & Result State
  const [previewLoading, setPreviewLoading] = useState(false);
  const [commitLoading, setCommitLoading] = useState(false);
  
  const [previewData, setPreviewData] = useState<{
    quizTitle: string;
    existingQuestionCount: number;
    questions: QuestionInput[];
  } | null>(null);

  const [errors, setErrors] = useState<RowErrorItem[] | null>(null);
  const [replaceExisting, setReplaceExisting] = useState(true);

  const [commitSuccess, setCommitSuccess] = useState<{
    importedQuestions: number;
    importedOptions: number;
    quizId: string;
    quizTitle: string;
    quizUrl: string;
  } | null>(null);

  // Update selectedQuizId if query param changes
  useEffect(() => {
    if (paramQuizId) {
      setSelectedQuizId(paramQuizId);
    }
  }, [paramQuizId]);

  // Fetch quizzes tree hierarchy
  const fetchTree = useCallback(async () => {
    setLoadingTree(true);
    try {
      const res = await fetch("/api/admin/quizzes");
      const data = await res.json();
      if (res.ok && data.ok) {
        setSubjects(data.data.subjects || []);
        setSections(data.data.sections || []);
        setQuizzes(data.data.quizzes || []);
      }
    } catch {
      // ignore
    } finally {
      setLoadingTree(false);
    }
  }, []);

  useEffect(() => {
    fetchTree();
  }, [fetchTree]);

  function handleReset() {
    setPreviewData(null);
    setErrors(null);
    setCommitSuccess(null);
  }

  // Handle Preview Request
  async function handlePreview() {
    if (!selectedQuizId) {
      alert("Vui lòng chọn Quiz đích!");
      return;
    }

    setPreviewLoading(true);
    setErrors(null);
    setPreviewData(null);
    setCommitSuccess(null);

    try {
      let res: Response;

      if (activeTab === "file") {
        if (!file) {
          alert("Vui lòng chọn file Excel hoặc CSV!");
          setPreviewLoading(false);
          return;
        }

        const formData = new FormData();
        formData.append("quizId", selectedQuizId);
        formData.append("file", file);

        res = await fetch("/api/admin/import/preview", {
          method: "POST",
          body: formData,
        });
      } else {
        if (!jsonText.trim()) {
          alert("Vui lòng dán dữ liệu JSON!");
          setPreviewLoading(false);
          return;
        }

        res = await fetch("/api/admin/import/preview", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            quizId: selectedQuizId,
            jsonText,
          }),
        });
      }

      const data = await res.json();

      if (!res.ok) {
        setErrors([
          {
            row: 0,
            field: "server",
            message: data.message || "Không thể xử lý dữ liệu xem trước",
          },
        ]);
        return;
      }

      if (data.ok === false) {
        setErrors(data.data?.errors || data.errors || []);
      } else if (data.ok === true) {
        setPreviewData({
          quizTitle: data.data.quiz.title,
          existingQuestionCount: data.data.quiz.existingQuestionCount,
          questions: data.data.questions,
        });
      }
    } catch {
      setErrors([
        {
          row: 0,
          field: "network",
          message: "Lỗi kết nối máy chủ khi gửi dữ liệu xem trước.",
        },
      ]);
    } finally {
      setPreviewLoading(false);
    }
  }

  // Handle Commit Request
  async function handleCommit() {
    if (!selectedQuizId || !previewData) return;

    setCommitLoading(true);
    try {
      const res = await fetch("/api/admin/import/commit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          quizId: selectedQuizId,
          questions: previewData.questions,
          replaceExisting,
        }),
      });

      const data = await res.json();

      if (!res.ok || !data.ok) {
        alert(data.message || "Nhập câu hỏi thất bại");
      } else {
        setCommitSuccess({
          importedQuestions: data.data.importedQuestions,
          importedOptions: data.data.importedOptions,
          quizId: data.data.quizId,
          quizTitle: data.data.quizTitle || previewData.quizTitle,
          quizUrl: data.data.quizUrl,
        });
        setPreviewData(null);
        fetchTree(); // Refresh tree
      }
    } catch {
      alert("Lỗi máy chủ khi ghi dữ liệu câu hỏi");
    } finally {
      setCommitLoading(false);
    }
  }

  const currentSelectedQuiz = quizzes.find((q) => q.id === selectedQuizId);

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div>
        <h1 className="text-xl font-bold text-foreground flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-primary" />
          Nhập hàng loạt câu hỏi vào Quiz (Excel / CSV / JSON)
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Hỗ trợ nhập tối đa 500 câu hỏi mỗi lượt, tự động kiểm tra định dạng và báo lỗi chi tiết theo dòng.
        </p>
      </div>

      {loadingTree ? (
        <div className="flex py-16 justify-center items-center gap-2 text-muted-foreground text-sm">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
          <span>Đang tải danh sách Môn học & Quiz...</span>
        </div>
      ) : (
        <>
          {/* Commit Success State */}
          {commitSuccess ? (
            <div className="space-y-6 animate-fade-in">
              <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-6 text-emerald-950 shadow-md space-y-4">
                <div className="flex items-center gap-3">
                  <div className="flex h-12 w-12 items-center justify-center rounded-full bg-emerald-100 text-emerald-600 shrink-0">
                    <CheckCircle2 className="h-8 w-8" />
                  </div>
                  <div>
                    <h2 className="text-lg font-bold">
                      Nhập thành công {commitSuccess.importedQuestions} câu hỏi ({commitSuccess.importedOptions} phương án)!
                    </h2>
                    <p className="text-xs text-emerald-800">
                      Quiz: <strong className="font-semibold">{commitSuccess.quizTitle}</strong> (ID: {commitSuccess.quizId})
                    </p>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-3 pt-2">
                  <Link
                    href={commitSuccess.quizUrl}
                    target="_blank"
                    className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-5 py-2.5 text-sm font-bold text-white shadow hover:bg-emerald-700 transition-colors"
                  >
                    <ExternalLink className="h-4 w-4" />
                    Mở Quiz để kiểm tra ngay
                  </Link>

                  <button
                    type="button"
                    onClick={handleReset}
                    className="inline-flex items-center gap-2 rounded-xl border border-emerald-300 bg-white px-4 py-2.5 text-sm font-semibold text-emerald-900 hover:bg-emerald-100 transition-colors"
                  >
                    <RefreshCw className="h-4 w-4" />
                    Nhập tiếp file khác
                  </button>
                </div>
              </div>

              {/* Quiz Questions Manager for verification */}
              <QuizQuestionsManager
                quizId={commitSuccess.quizId}
                quizTitle={commitSuccess.quizTitle}
                onQuestionsUpdated={fetchTree}
              />
            </div>
          ) : errors ? (
            /* Error List View */
            <ImportErrorList errors={errors} onReset={handleReset} />
          ) : previewData ? (
            /* Preview Table View */
            <ImportPreviewTable
              quizTitle={previewData.quizTitle}
              existingQuestionCount={previewData.existingQuestionCount}
              questions={previewData.questions}
              replaceExisting={replaceExisting}
              onChangeReplaceExisting={setReplaceExisting}
              onReset={handleReset}
              onCommit={handleCommit}
              loading={commitLoading}
            />
          ) : (
            /* Form View */
            <div className="space-y-6">
              <ImportFileForm
                subjects={subjects}
                sections={sections}
                quizzes={quizzes}
                selectedQuizId={selectedQuizId}
                onSelectQuizId={setSelectedQuizId}
                activeTab={activeTab}
                onSelectTab={setActiveTab}
                file={file}
                onSelectFile={setFile}
                jsonText={jsonText}
                onChangeJsonText={setJsonText}
                onPreview={handlePreview}
                loading={previewLoading}
              />

              {/* If a quiz is selected, show existing questions manager directly */}
              {selectedQuizId && currentSelectedQuiz && (
                <QuizQuestionsManager
                  quizId={selectedQuizId}
                  quizTitle={currentSelectedQuiz.title}
                  onQuestionsUpdated={fetchTree}
                />
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}

export default function AdminImportPage() {
  return (
    <Suspense
      fallback={
        <div className="flex py-16 justify-center items-center gap-2 text-muted-foreground text-sm">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
          <span>Đang tải...</span>
        </div>
      }
    >
      <ImportPageContent />
    </Suspense>
  );
}
