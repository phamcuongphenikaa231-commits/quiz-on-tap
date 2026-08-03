"use client";

import { useState, useEffect, useMemo } from "react";
import {
  FileSpreadsheet,
  FileCode,
  Download,
  UploadCloud,
  FileCheck2,
  Loader2,
} from "lucide-react";

export interface SubjectItem {
  id: string;
  title: string;
  slug: string;
}

export interface SectionItem {
  id: string;
  subjectId: string;
  parentId: string | null;
  title: string;
  slug: string;
}

export interface QuizItem {
  id: string;
  subjectId: string;
  sectionId: string;
  title: string;
  slug: string;
  questionCount: number;
}

interface ImportFileFormProps {
  subjects: SubjectItem[];
  sections: SectionItem[];
  quizzes: QuizItem[];
  selectedQuizId: string;
  onSelectQuizId: (quizId: string) => void;
  activeTab: "file" | "json";
  onSelectTab: (tab: "file" | "json") => void;
  file: File | null;
  onSelectFile: (file: File | null) => void;
  jsonText: string;
  onChangeJsonText: (text: string) => void;
  onPreview: () => void;
  loading: boolean;
}

const SAMPLE_JSON_ARRAY = [
  {
    questionText: "Thủ đô của Việt Nam là thành phố nào?",
    generalExplanation: "Hà Nội là thủ đô chính thức của Việt Nam.",
    sortOrder: 1,
    options: [
      {
        text: "Thành phố Hồ Chí Minh",
        isCorrect: false,
        explanation: "TP.HCM là trung tâm kinh tế lớn nhất.",
        sortOrder: 1,
      },
      {
        text: "Hà Nội",
        isCorrect: true,
        explanation: "Đúng. Hà Nội là thủ đô của Việt Nam.",
        sortOrder: 2,
      },
      {
        text: "Đà Nẵng",
        isCorrect: false,
        explanation: "Đà Nẵng ở miền Trung.",
        sortOrder: 3,
      },
      {
        text: "Hải Phòng",
        isCorrect: false,
        explanation: "Hải Phòng là thành phố cảng.",
        sortOrder: 4,
      },
    ],
  },
];

export function ImportFileForm({
  subjects,
  sections,
  quizzes,
  selectedQuizId,
  onSelectQuizId,
  activeTab,
  onSelectTab,
  file,
  onSelectFile,
  jsonText,
  onChangeJsonText,
  onPreview,
  loading,
}: ImportFileFormProps) {
  const [selectedSubjectId, setSelectedSubjectId] = useState<string>("");
  const [selectedSectionId, setSelectedSectionId] = useState<string>("");

  // Sync selectedSubjectId & selectedSectionId when selectedQuizId is set (Reverse lookup)
  useEffect(() => {
    if (selectedQuizId && quizzes.length > 0) {
      const q = quizzes.find((item) => item.id === selectedQuizId);
      if (q) {
        const subId = q.subjectId || (q as unknown as { subject_id?: string }).subject_id;
        const secId = q.sectionId || (q as unknown as { section_id?: string }).section_id;
        if (subId) setSelectedSubjectId(subId);
        if (secId) setSelectedSectionId(secId);
      }
    }
  }, [selectedQuizId, quizzes]);

  // Filter sections by selected subject
  const filteredSections = useMemo(() => {
    if (!selectedSubjectId) return [];
    return sections.filter(
      (s) => (s.subjectId || (s as unknown as { subject_id?: string }).subject_id) === selectedSubjectId
    );
  }, [sections, selectedSubjectId]);

  // Filter quizzes by selected section & subject
  const filteredQuizzes = useMemo(() => {
    if (!selectedSubjectId) return [];
    let list = quizzes.filter(
      (q) => (q.subjectId || (q as unknown as { subject_id?: string }).subject_id) === selectedSubjectId
    );
    if (selectedSectionId) {
      list = list.filter(
        (q) => (q.sectionId || (q as unknown as { section_id?: string }).section_id) === selectedSectionId
      );
    }
    return list;
  }, [quizzes, selectedSubjectId, selectedSectionId]);

  function handleFillSampleJson() {
    onChangeJsonText(JSON.stringify(SAMPLE_JSON_ARRAY, null, 2));
  }

  return (
    <div className="space-y-6">
      {/* Target Selector Card */}
      <div className="rounded-xl border bg-card p-5 shadow-sm space-y-4">
        <h3 className="text-base font-bold text-foreground flex items-center gap-2">
          <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary text-xs text-primary-foreground">
            1
          </span>
          Chọn Quiz đích cần nhập câu hỏi
        </h3>

        <div className="grid gap-4 sm:grid-cols-3">
          {/* Subject Dropdown */}
          <div>
            <label className="block text-xs font-semibold text-muted-foreground mb-1">
              Môn học <span className="text-destructive">*</span>
            </label>
            <select
              value={selectedSubjectId}
              onChange={(e) => {
                const subId = e.target.value;
                setSelectedSubjectId(subId);
                setSelectedSectionId("");
                onSelectQuizId("");
              }}
              className="w-full rounded-lg border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/20"
            >
              <option value="">-- Chọn môn học --</option>
              {subjects.map((sub) => (
                <option key={sub.id} value={sub.id}>
                  {sub.title}
                </option>
              ))}
            </select>
          </div>

          {/* Section Dropdown */}
          <div>
            <label className="block text-xs font-semibold text-muted-foreground mb-1">
              Phần / Chương (Tùy chọn)
            </label>
            <select
              disabled={!selectedSubjectId}
              value={selectedSectionId}
              onChange={(e) => {
                const secId = e.target.value;
                setSelectedSectionId(secId);
                onSelectQuizId("");
              }}
              className="w-full rounded-lg border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/20 disabled:opacity-50"
            >
              <option value="">-- Tất cả phần --</option>
              {filteredSections.map((sec) => (
                <option key={sec.id} value={sec.id}>
                  {sec.title}
                </option>
              ))}
            </select>
          </div>

          {/* Quiz Dropdown */}
          <div>
            <label className="block text-xs font-semibold text-muted-foreground mb-1">
              Quiz đích <span className="text-destructive">*</span>
            </label>
            <select
              disabled={!selectedSubjectId}
              value={selectedQuizId}
              onChange={(e) => onSelectQuizId(e.target.value)}
              className="w-full rounded-lg border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/20 disabled:opacity-50"
            >
              <option value="">-- Chọn quiz --</option>
              {filteredQuizzes.map((quiz) => (
                <option key={quiz.id} value={quiz.id}>
                  {quiz.title} ({quiz.questionCount} câu cũ)
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Input Source Card */}
      <div className="rounded-xl border bg-card p-5 shadow-sm space-y-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <h3 className="text-base font-bold text-foreground flex items-center gap-2">
            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary text-xs text-primary-foreground">
              2
            </span>
            Chọn nguồn dữ liệu câu hỏi
          </h3>

          <a
            href="/api/admin/import/template"
            download="mau-nhap-cau-hoi-quiz.xlsx"
            className="inline-flex items-center gap-1.5 rounded-lg border bg-emerald-50 px-3 py-1.5 text-xs font-medium text-emerald-700 hover:bg-emerald-100 transition-colors border-emerald-200"
          >
            <Download className="h-4 w-4 text-emerald-600" />
            Tải file mẫu Excel (.xlsx)
          </a>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-border">
          <button
            type="button"
            onClick={() => onSelectTab("file")}
            className={`flex items-center gap-2 border-b-2 px-4 py-2.5 text-sm font-semibold transition-colors ${
              activeTab === "file"
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            <FileSpreadsheet className="h-4 w-4" />
            Tải Excel / CSV
          </button>
          <button
            type="button"
            onClick={() => onSelectTab("json")}
            className={`flex items-center gap-2 border-b-2 px-4 py-2.5 text-sm font-semibold transition-colors ${
              activeTab === "json"
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            <FileCode className="h-4 w-4" />
            Dán JSON
          </button>
        </div>

        {/* Tab 1: File Upload */}
        {activeTab === "file" && (
          <div className="space-y-3 pt-2">
            <label className="relative flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-muted-foreground/30 p-8 text-center hover:bg-accent/40 cursor-pointer transition-colors">
              <UploadCloud className="h-10 w-10 text-primary mb-2" />
              <p className="text-sm font-semibold text-foreground">
                Kéo thả file vào đây hoặc <span className="text-primary underline">chọn file từ máy tính</span>
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                Hỗ trợ định dạng: .xlsx, .xls, .csv (Tối đa 5 MB & 500 câu)
              </p>
              <input
                type="file"
                accept=".xlsx,.xls,.csv"
                className="hidden"
                onChange={(e) => {
                  const selected = e.target.files?.[0] || null;
                  onSelectFile(selected);
                }}
              />
            </label>

            {file && (
              <div className="flex items-center justify-between rounded-lg bg-primary/10 px-4 py-2.5 text-sm border border-primary/20 text-primary">
                <div className="flex items-center gap-2 font-medium">
                  <FileCheck2 className="h-4 w-4" />
                  <span>{file.name}</span>
                  <span className="text-xs text-muted-foreground">
                    ({(file.size / 1024).toFixed(1)} KB)
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => onSelectFile(null)}
                  className="text-xs font-semibold text-destructive hover:underline"
                >
                  Xóa
                </button>
              </div>
            )}
          </div>
        )}

        {/* Tab 2: JSON Input */}
        {activeTab === "json" && (
          <div className="space-y-3 pt-2">
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground">
                Dán mảng JSON chứa các câu hỏi theo đúng định dạng
              </span>
              <button
                type="button"
                onClick={handleFillSampleJson}
                className="text-xs font-medium text-primary hover:underline"
              >
                Dùng mảng JSON mẫu
              </button>
            </div>

            <textarea
              rows={12}
              value={jsonText}
              onChange={(e) => onChangeJsonText(e.target.value)}
              placeholder="[\n  {\n    'questionText': 'Nội dung câu hỏi?',\n    'generalExplanation': 'Lời giải thích chung...'\n  }\n]"
              className="w-full rounded-lg border bg-slate-950 p-3 text-xs font-mono text-slate-50 outline-none focus:ring-2 focus:ring-primary/20"
            />
          </div>
        )}

        {/* Preview Action */}
        <div className="flex justify-end pt-2">
          <button
            type="button"
            onClick={onPreview}
            disabled={
              loading ||
              !selectedQuizId ||
              (activeTab === "file" && !file) ||
              (activeTab === "json" && !jsonText.trim())
            }
            className="flex items-center gap-2 rounded-lg bg-primary px-6 py-2.5 text-sm font-semibold text-primary-foreground shadow hover:bg-primary/90 transition-colors disabled:opacity-50"
          >
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Đang xử lý & kiểm tra...
              </>
            ) : (
              "Kiểm tra & Xem trước"
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
