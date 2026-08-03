"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import { toSlug } from "@/lib/utils/slug";
import {
  BookOpen,
  FolderTree,
  FileQuestion,
  Plus,
  Edit3,
  Trash2,
  Eye,
  EyeOff,
  ChevronRight,
  ChevronDown,
  Upload,
  Loader2,
  X,
  Layers,
} from "lucide-react";

interface Subject {
  id: string;
  title: string;
  slug: string;
  description: string;
  sort_order: number;
  is_published: boolean;
}

interface Section {
  id: string;
  subject_id: string;
  parent_id: string | null;
  title: string;
  slug: string;
  sort_order: number;
  is_published: boolean;
}

interface Quiz {
  id: string;
  subject_id: string;
  section_id: string;
  subjectId?: string;
  sectionId?: string;
  title: string;
  slug: string;
  description?: string;
  question_limit?: number;
  shuffle_questions?: boolean;
  shuffle_options?: boolean;
  sort_order: number;
  is_published?: boolean;
  questionCount?: number;
}

interface SectionNode extends Section {
  children: SectionNode[];
  quizzes: Quiz[];
}

export default function AdminContentPage() {
  const router = useRouter();

  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [sections, setSections] = useState<Section[]>([]);
  const [quizzes, setQuizzes] = useState<Quiz[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [selectedSubjectId, setSelectedSubjectId] = useState<string>("");

  // Collapsed sections tracker
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({});

  // Modals state
  const [subjectModal, setSubjectModal] = useState<{
    open: boolean;
    mode: "create" | "edit";
    subject?: Subject;
  }>({ open: false, mode: "create" });

  const [sectionModal, setSectionModal] = useState<{
    open: boolean;
    mode: "create" | "edit";
    parentId?: string | null;
    section?: Section;
  }>({ open: false, mode: "create" });

  const [quizModal, setQuizModal] = useState<{
    open: boolean;
    mode: "create" | "edit";
    sectionId?: string;
    quiz?: Quiz;
  }>({ open: false, mode: "create" });

  // Form Fields - Subject
  const [subTitle, setSubTitle] = useState("");
  const [subSlug, setSubSlug] = useState("");
  const [subDesc, setSubDesc] = useState("");
  const [subSort, setSubSort] = useState(0);
  const [subPublish, setSubPublish] = useState(true);
  const [subSlugManuallyEdited, setSubSlugManuallyEdited] = useState(false);

  // Form Fields - Section
  const [secTitle, setSecTitle] = useState("");
  const [secSlug, setSecSlug] = useState("");
  const [secParentId, setSecParentId] = useState<string | null>(null);
  const [secSort, setSecSort] = useState(0);
  const [secPublish, setSecPublish] = useState(true);
  const [secSlugManuallyEdited, setSecSlugManuallyEdited] = useState(false);

  // Form Fields - Quiz
  const [quizTitle, setQuizTitle] = useState("");
  const [quizSlug, setQuizSlug] = useState("");
  const [quizDesc, setQuizDesc] = useState("");
  const [quizQuestionLimit, setQuizQuestionLimit] = useState(25);
  const [quizShuffleQuestions, setQuizShuffleQuestions] = useState(true);
  const [quizShuffleOptions, setQuizShuffleOptions] = useState(true);
  const [quizSort, setQuizSort] = useState(0);
  const [quizPublish, setQuizPublish] = useState(true);
  const [quizSlugManuallyEdited, setQuizSlugManuallyEdited] = useState(false);

  // Fetch Tree Data
  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/quizzes");
      const data = await res.json();
      if (res.ok && data.ok) {
        setSubjects(data.data.subjects || []);
        setSections(data.data.sections || []);
        setQuizzes(data.data.quizzes || []);

        if (!selectedSubjectId && data.data.subjects?.length > 0) {
          setSelectedSubjectId(data.data.subjects[0].id);
        }
      }
    } catch {
      alert("Lỗi tải dữ liệu cây môn học");
    } finally {
      setLoading(false);
    }
  }, [selectedSubjectId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Selected Subject Object
  const currentSubject = useMemo(
    () => subjects.find((s) => s.id === selectedSubjectId),
    [subjects, selectedSubjectId]
  );

  // Build recursive section tree for selected subject
  const sectionTree = useMemo(() => {
    if (!selectedSubjectId) return [];

    const subSections = sections.filter((s) => s.subject_id === selectedSubjectId);
    const subQuizzes = quizzes.filter(
      (q) => (q.subjectId || q.subject_id) === selectedSubjectId
    );

    const map = new Map<string, SectionNode>();
    subSections.forEach((sec) => {
      map.set(sec.id, {
        ...sec,
        children: [],
        quizzes: subQuizzes.filter(
          (q) => (q.sectionId || q.section_id) === sec.id
        ),
      });
    });

    const rootNodes: SectionNode[] = [];

    subSections.forEach((sec) => {
      const node = map.get(sec.id)!;
      if (sec.parent_id && map.has(sec.parent_id)) {
        map.get(sec.parent_id)!.children.push(node);
      } else {
        rootNodes.push(node);
      }
    });

    return rootNodes;
  }, [sections, quizzes, selectedSubjectId]);

  // Auto-expand all section nodes initially
  useEffect(() => {
    const expandMap: Record<string, boolean> = {};
    sections.forEach((s) => {
      expandMap[s.id] = true;
    });
    setExpandedSections((prev) => ({ ...expandMap, ...prev }));
  }, [sections]);

  function toggleSectionExpand(id: string) {
    setExpandedSections((prev) => ({ ...prev, [id]: !prev[id] }));
  }

  // ---------------- SUBJECT HANDLERS ----------------
  function openCreateSubjectModal() {
    setSubTitle("");
    setSubSlug("");
    setSubDesc("");
    setSubSort(subjects.length + 1);
    setSubPublish(true);
    setSubSlugManuallyEdited(false);
    setSubjectModal({ open: true, mode: "create" });
  }

  function openEditSubjectModal(sub: Subject) {
    setSubTitle(sub.title);
    setSubSlug(sub.slug);
    setSubDesc(sub.description || "");
    setSubSort(sub.sort_order);
    setSubPublish(sub.is_published);
    setSubSlugManuallyEdited(true);
    setSubjectModal({ open: true, mode: "edit", subject: sub });
  }

  async function handleSaveSubject(e: React.FormEvent) {
    e.preventDefault();
    if (saving) return;

    setSaving(true);
    try {
      const payload = {
        title: subTitle,
        slug: subSlug,
        description: subDesc,
        sortOrder: subSort,
        isPublished: subPublish,
      };

      let res: Response;
      if (subjectModal.mode === "create") {
        res = await fetch("/api/admin/subjects", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
      } else {
        res = await fetch(`/api/admin/subjects/${subjectModal.subject!.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
      }

      const data = await res.json();
      if (!res.ok || !data.ok) {
        alert(data.message || "Lỗi lưu môn học");
        return;
      }

      setSubjectModal({ open: false, mode: "create" });
      fetchData();
      if (subjectModal.mode === "create" && data.data?.id) {
        setSelectedSubjectId(data.data.id);
      }
    } catch {
      alert("Lỗi kết nối server");
    } finally {
      setSaving(false);
    }
  }

  async function handleDeleteSubject(sub: Subject) {
    const confirmMsg = `⚠️ CẢNH BÁO NGUY HIỂM:\n\nBạn có chắc chắn muốn xóa môn học "${sub.title}"?\n\nToàn bộ phần, phần con, quiz và câu hỏi bên trong môn học này SẼ BỊ XÓA VĨNH VIỄN khỏi hệ thống!`;
    if (!confirm(confirmMsg)) return;

    try {
      const res = await fetch(`/api/admin/subjects/${sub.id}`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        alert(data.message || "Xóa môn học thất bại");
        return;
      }

      if (selectedSubjectId === sub.id) {
        setSelectedSubjectId("");
      }
      fetchData();
    } catch {
      alert("Lỗi máy chủ khi xóa môn học");
    }
  }

  async function handleToggleSubjectPublish(sub: Subject) {
    try {
      const res = await fetch(`/api/admin/subjects/${sub.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isPublished: !sub.is_published }),
      });
      const data = await res.json();
      if (res.ok && data.ok) {
        fetchData();
      } else {
        alert(data.message || "Không thể cập nhật trạng thái môn học");
      }
    } catch {
      alert("Lỗi máy chủ");
    }
  }

  // ---------------- SECTION HANDLERS ----------------
  function openCreateSectionModal(parentId: string | null = null) {
    setSecTitle("");
    setSecSlug("");
    setSecParentId(parentId);
    setSecSort(sections.length + 1);
    setSecPublish(true);
    setSecSlugManuallyEdited(false);
    setSectionModal({ open: true, mode: "create", parentId });
  }

  function openEditSectionModal(sec: Section) {
    setSecTitle(sec.title);
    setSecSlug(sec.slug);
    setSecParentId(sec.parent_id);
    setSecSort(sec.sort_order);
    setSecPublish(sec.is_published);
    setSecSlugManuallyEdited(true);
    setSectionModal({ open: true, mode: "edit", section: sec });
  }

  async function handleSaveSection(e: React.FormEvent) {
    e.preventDefault();
    if (saving || !selectedSubjectId) return;

    setSaving(true);
    try {
      const payload = {
        subjectId: selectedSubjectId,
        parentId: secParentId,
        title: secTitle,
        slug: secSlug,
        sortOrder: secSort,
        isPublished: secPublish,
      };

      let res: Response;
      if (sectionModal.mode === "create") {
        res = await fetch("/api/admin/sections", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
      } else {
        res = await fetch(`/api/admin/sections/${sectionModal.section!.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
      }

      const data = await res.json();
      if (!res.ok || !data.ok) {
        alert(data.message || "Lỗi lưu phần");
        return;
      }

      setSectionModal({ open: false, mode: "create" });
      fetchData();
    } catch {
      alert("Lỗi kết nối server");
    } finally {
      setSaving(false);
    }
  }

  async function handleDeleteSection(sec: Section) {
    if (!confirm(`Xóa phần "${sec.title}"? Tất cả phần con và quiz bên trong cũng sẽ bị xóa.`)) {
      return;
    }

    try {
      const res = await fetch(`/api/admin/sections/${sec.id}`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (res.ok && data.ok) {
        fetchData();
      } else {
        alert(data.message || "Xóa phần thất bại");
      }
    } catch {
      alert("Lỗi máy chủ khi xóa phần");
    }
  }

  async function handleToggleSectionPublish(sec: Section) {
    try {
      const res = await fetch(`/api/admin/sections/${sec.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isPublished: !sec.is_published }),
      });
      const data = await res.json();
      if (res.ok && data.ok) {
        fetchData();
      } else {
        alert(data.message || "Không thể đổi trạng thái phần");
      }
    } catch {
      alert("Lỗi máy chủ");
    }
  }

  // ---------------- QUIZ HANDLERS ----------------
  function openCreateQuizModal(sectionId: string) {
    setQuizTitle("");
    setQuizSlug("");
    setQuizDesc("");
    setQuizQuestionLimit(25);
    setQuizShuffleQuestions(true);
    setQuizShuffleOptions(true);
    setQuizSort(quizzes.length + 1);
    setQuizPublish(true);
    setQuizSlugManuallyEdited(false);
    setQuizModal({ open: true, mode: "create", sectionId });
  }

  function openEditQuizModal(q: Quiz) {
    setQuizTitle(q.title);
    setQuizSlug(q.slug);
    setQuizDesc(q.description || "");
    setQuizQuestionLimit(q.question_limit ?? 25);
    setQuizShuffleQuestions(q.shuffle_questions ?? true);
    setQuizShuffleOptions(q.shuffle_options ?? true);
    setQuizSort(q.sort_order);
    setQuizPublish(q.is_published ?? true);
    setQuizSlugManuallyEdited(true);
    setQuizModal({ open: true, mode: "edit", quiz: q });
  }

  async function handleSaveQuiz(e: React.FormEvent) {
    e.preventDefault();
    if (saving || !selectedSubjectId) return;

    setSaving(true);
    try {
      const payload = {
        subjectId: selectedSubjectId,
        sectionId: quizModal.sectionId || quizModal.quiz?.section_id,
        title: quizTitle,
        slug: quizSlug,
        description: quizDesc,
        questionLimit: quizQuestionLimit,
        shuffleQuestions: quizShuffleQuestions,
        shuffleOptions: quizShuffleOptions,
        sortOrder: quizSort,
        isPublished: quizPublish,
      };

      let res: Response;
      if (quizModal.mode === "create") {
        res = await fetch("/api/admin/quizzes", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
      } else {
        res = await fetch(`/api/admin/quizzes/${quizModal.quiz!.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
      }

      const data = await res.json();
      if (!res.ok || !data.ok) {
        alert(data.message || "Lỗi lưu quiz");
        return;
      }

      setQuizModal({ open: false, mode: "create" });
      fetchData();
    } catch {
      alert("Lỗi kết nối server");
    } finally {
      setSaving(false);
    }
  }

  async function handleDeleteQuiz(q: Quiz) {
    if (!confirm(`Xóa quiz "${q.title}"? Tất cả câu hỏi bên trong cũng sẽ bị xóa.`)) return;

    try {
      const res = await fetch(`/api/admin/quizzes/${q.id}`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (res.ok && data.ok) {
        fetchData();
      } else {
        alert(data.message || "Xóa quiz thất bại");
      }
    } catch {
      alert("Lỗi máy chủ khi xóa quiz");
    }
  }

  async function handleToggleQuizPublish(q: Quiz) {
    try {
      const res = await fetch(`/api/admin/quizzes/${q.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isPublished: !q.is_published }),
      });
      const data = await res.json();
      if (res.ok && data.ok) {
        fetchData();
      } else {
        alert(data.message || "Không thể đổi trạng thái quiz");
      }
    } catch {
      alert("Lỗi máy chủ");
    }
  }

  // Navigate to Import Questions Page for a Quiz
  function handleGoToImport(q: Quiz) {
    const subId = q.subject_id || q.subjectId;
    const secId = q.section_id || q.sectionId;

    const params = new URLSearchParams();
    if (q.id) params.set("quizId", q.id);
    if (subId) params.set("subjectId", subId);
    if (secId) params.set("sectionId", secId);

    router.push(`/admin/import?${params.toString()}`);
  }

  // ---------------- RECURSIVE TREE COMPONENT ----------------
  function renderSectionNode(node: SectionNode, depth: number = 0) {
    const isExpanded = expandedSections[node.id] ?? true;

    return (
      <div key={node.id} className="space-y-2 border-l-2 border-border/60 pl-3 sm:pl-4 my-2">
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-card p-2.5 border shadow-sm hover:border-primary/30 transition-colors">
          <div className="flex items-center gap-2 min-w-0">
            <button
              type="button"
              onClick={() => toggleSectionExpand(node.id)}
              className="p-1 text-muted-foreground hover:text-foreground"
            >
              {isExpanded ? (
                <ChevronDown className="h-4 w-4" />
              ) : (
                <ChevronRight className="h-4 w-4" />
              )}
            </button>

            <FolderTree className="h-4 w-4 text-amber-500 shrink-0" />

            <div className="truncate">
              <span className="font-semibold text-sm text-foreground mr-2">
                {node.title}
              </span>
              <span className="text-xs font-mono text-muted-foreground">
                ({node.slug})
              </span>
            </div>

            <button
              type="button"
              onClick={() => handleToggleSectionPublish(node)}
              title={node.is_published ? "Đã xuất bản" : "Chưa xuất bản"}
              className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                node.is_published
                  ? "bg-emerald-100 text-emerald-800"
                  : "bg-gray-100 text-gray-600"
              }`}
            >
              {node.is_published ? "Xuất bản" : "Ẩn"}
            </button>
          </div>

          {/* Section Actions */}
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => openCreateQuizModal(node.id)}
              className="flex items-center gap-1 rounded bg-primary/10 px-2 py-1 text-xs font-semibold text-primary hover:bg-primary/20 transition-colors"
            >
              <Plus className="h-3.5 w-3.5" />
              Thêm Quiz
            </button>

            <button
              type="button"
              onClick={() => openCreateSectionModal(node.id)}
              className="flex items-center gap-1 rounded border px-2 py-1 text-xs font-medium text-foreground hover:bg-accent transition-colors"
              title="Thêm phần con"
            >
              <Plus className="h-3.5 w-3.5" />
              Phần con
            </button>

            <button
              type="button"
              onClick={() => openEditSectionModal(node)}
              className="p-1.5 text-muted-foreground hover:text-foreground hover:bg-accent rounded"
              title="Sửa phần"
            >
              <Edit3 className="h-3.5 w-3.5" />
            </button>

            <button
              type="button"
              onClick={() => handleDeleteSection(node)}
              className="p-1.5 text-muted-foreground hover:text-red-600 hover:bg-red-50 rounded"
              title="Xóa phần"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>

        {/* Expanded Content: Quizzes & Sub-sections */}
        {isExpanded && (
          <div className="space-y-2 pt-1">
            {/* Quizzes List */}
            {node.quizzes.length > 0 && (
              <div className="ml-4 space-y-1.5">
                {node.quizzes.map((quiz) => (
                  <div
                    key={quiz.id}
                    className="flex flex-wrap items-center justify-between gap-2 rounded-md bg-accent/30 p-2 border text-xs"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <FileQuestion className="h-4 w-4 text-blue-500 shrink-0" />
                      <span className="font-bold text-foreground">
                        {quiz.title}
                      </span>
                      <span className="text-muted-foreground font-mono">
                        ({quiz.slug})
                      </span>
                      <span className="rounded bg-blue-100 px-1.5 py-0.5 text-[10px] font-bold text-blue-800">
                        {quiz.questionCount ?? 0} câu
                      </span>
                    </div>

                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => handleGoToImport(quiz)}
                        className="flex items-center gap-1 rounded bg-emerald-600 px-2 py-1 text-[11px] font-bold text-white hover:bg-emerald-700 transition-colors shadow-sm"
                        title="Nhập hàng loạt câu hỏi"
                      >
                        <Upload className="h-3 w-3" />
                        Nhập câu hỏi
                      </button>

                      <button
                        type="button"
                        onClick={() => handleToggleQuizPublish(quiz)}
                        className={`p-1 rounded ${
                          quiz.is_published ? "text-emerald-600" : "text-gray-400"
                        }`}
                        title={quiz.is_published ? "Đã xuất bản" : "Ẩn"}
                      >
                        {quiz.is_published ? (
                          <Eye className="h-3.5 w-3.5" />
                        ) : (
                          <EyeOff className="h-3.5 w-3.5" />
                        )}
                      </button>

                      <button
                        type="button"
                        onClick={() => openEditQuizModal(quiz)}
                        className="p-1 text-muted-foreground hover:text-foreground"
                      >
                        <Edit3 className="h-3.5 w-3.5" />
                      </button>

                      <button
                        type="button"
                        onClick={() => handleDeleteQuiz(quiz)}
                        className="p-1 text-muted-foreground hover:text-red-600"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Sub-sections recursive render */}
            {node.children.length > 0 && (
              <div className="ml-2">
                {node.children.map((childNode) =>
                  renderSectionNode(childNode, depth + 1)
                )}
              </div>
            )}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-bold text-foreground flex items-center gap-2">
            <Layers className="h-5 w-5 text-primary" />
            Quản lý Cấu trúc Nội dung
          </h1>
          <p className="text-sm text-muted-foreground">
            Tạo Môn học ➔ Phần / Phần con (đệ quy) ➔ Quiz
          </p>
        </div>

        <button
          type="button"
          onClick={openCreateSubjectModal}
          className="flex items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground shadow hover:bg-primary/90 transition-colors"
        >
          <Plus className="h-4 w-4" />
          Thêm Môn học mới
        </button>
      </div>

      {loading ? (
        <div className="flex py-16 justify-center items-center gap-2 text-muted-foreground text-sm">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
          <span>Đang tải cấu trúc môn học...</span>
        </div>
      ) : subjects.length === 0 ? (
        <div className="rounded-xl border bg-card p-12 text-center text-muted-foreground space-y-3">
          <BookOpen className="h-12 w-12 text-muted-foreground mx-auto" />
          <p className="text-base font-semibold">Chưa có môn học nào trong hệ thống.</p>
          <button
            type="button"
            onClick={openCreateSubjectModal}
            className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
          >
            Tạo môn học đầu tiên
          </button>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Subject Navigation Tabs */}
          <div className="flex items-center gap-2 border-b overflow-x-auto pb-2 pr-2">
            {subjects.map((sub) => (
              <div
                key={sub.id}
                className={`flex items-center gap-1.5 rounded-lg px-3.5 py-2 text-sm font-semibold cursor-pointer shrink-0 transition-colors ${
                  selectedSubjectId === sub.id
                    ? "bg-primary text-primary-foreground shadow"
                    : "bg-card border text-foreground hover:bg-accent"
                }`}
                onClick={() => setSelectedSubjectId(sub.id)}
              >
                <BookOpen className="h-4 w-4" />
                <span>{sub.title}</span>
                <span className="text-xs opacity-75 font-mono">({sub.slug})</span>

                {/* Status indicator */}
                <span
                  className={`h-2 w-2 rounded-full ${
                    sub.is_published ? "bg-emerald-400" : "bg-gray-300"
                  }`}
                  title={sub.is_published ? "Đã xuất bản" : "Ẩn"}
                />
              </div>
            ))}
          </div>

          {/* Current Subject Control Panel */}
          {currentSubject && (
            <div className="rounded-xl border bg-card p-5 shadow-sm space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b pb-4">
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-lg font-bold text-foreground">
                      Môn: {currentSubject.title}
                    </h2>
                    <button
                      type="button"
                      onClick={() => handleToggleSubjectPublish(currentSubject)}
                      className={`px-2 py-0.5 rounded text-xs font-bold ${
                        currentSubject.is_published
                          ? "bg-emerald-100 text-emerald-800"
                          : "bg-gray-100 text-gray-600"
                      }`}
                    >
                      {currentSubject.is_published ? "Đã xuất bản" : "Chưa xuất bản"}
                    </button>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    Slug: <code className="font-mono">{currentSubject.slug}</code> | {currentSubject.description || "Chưa có mô tả"}
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => openCreateSectionModal(null)}
                    className="flex items-center gap-1.5 rounded-lg bg-primary px-3.5 py-2 text-xs font-bold text-primary-foreground hover:bg-primary/90 shadow-sm"
                  >
                    <Plus className="h-4 w-4" />
                    Thêm Phần cấp 1
                  </button>

                  <button
                    type="button"
                    onClick={() => openEditSubjectModal(currentSubject)}
                    className="p-2 rounded-lg border text-muted-foreground hover:text-foreground hover:bg-accent"
                    title="Sửa môn học"
                  >
                    <Edit3 className="h-4 w-4" />
                  </button>

                  <button
                    type="button"
                    onClick={() => handleDeleteSubject(currentSubject)}
                    className="p-2 rounded-lg border text-muted-foreground hover:text-red-600 hover:bg-red-50"
                    title="Xóa môn học"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>

              {/* Sections Tree */}
              <div>
                <h3 className="text-sm font-bold text-foreground mb-3 flex items-center gap-2">
                  <FolderTree className="h-4 w-4 text-primary" />
                  Cấu trúc các Phần & Quiz trong môn
                </h3>

                {sectionTree.length === 0 ? (
                  <div className="p-8 text-center border border-dashed rounded-lg text-sm text-muted-foreground space-y-2">
                    <p>Môn học này chưa có Phần nào.</p>
                    <button
                      type="button"
                      onClick={() => openCreateSectionModal(null)}
                      className="text-xs font-bold text-primary hover:underline"
                    >
                      + Thêm Phần cấp 1 đầu tiên
                    </button>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {sectionTree.map((rootNode) => renderSectionNode(rootNode))}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ---------------- MODAL: SUBJECT ---------------- */}
      {subjectModal.open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-2xl bg-card p-6 shadow-xl border animate-fade-in space-y-4">
            <div className="flex items-center justify-between border-b pb-3">
              <h3 className="font-bold text-base text-foreground">
                {subjectModal.mode === "create" ? "Tạo môn học mới" : "Chỉnh sửa môn học"}
              </h3>
              <button
                onClick={() => setSubjectModal({ open: false, mode: "create" })}
                className="text-muted-foreground hover:text-foreground"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleSaveSubject} className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-foreground mb-1">
                  Tên môn học <span className="text-destructive">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="Ví dụ: Toán học 12"
                  value={subTitle}
                  onChange={(e) => {
                    const val = e.target.value;
                    setSubTitle(val);
                    if (!subSlugManuallyEdited) {
                      setSubSlug(toSlug(val));
                    }
                  }}
                  className="w-full rounded-lg border bg-background px-3 py-2 text-xs outline-none focus:ring-2 focus:ring-primary/20"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-foreground mb-1">
                  Slug (Tự sinh từ tên, có thể sửa) <span className="text-destructive">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="toan-hoc-12"
                  value={subSlug}
                  onChange={(e) => {
                    setSubSlugManuallyEdited(true);
                    setSubSlug(toSlug(e.target.value));
                  }}
                  className="w-full rounded-lg border bg-background px-3 py-2 text-xs font-mono outline-none focus:ring-2 focus:ring-primary/20"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-foreground mb-1">
                  Mô tả
                </label>
                <textarea
                  rows={2}
                  placeholder="Mô tả ngắn về môn học..."
                  value={subDesc}
                  onChange={(e) => setSubDesc(e.target.value)}
                  className="w-full rounded-lg border bg-background px-3 py-2 text-xs outline-none focus:ring-2 focus:ring-primary/20"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-foreground mb-1">
                    Thứ tự (Sort order)
                  </label>
                  <input
                    type="number"
                    value={subSort}
                    onChange={(e) => setSubSort(parseInt(e.target.value, 10) || 0)}
                    className="w-full rounded-lg border bg-background px-3 py-1.5 text-xs outline-none focus:ring-2 focus:ring-primary/20"
                  />
                </div>

                <div className="flex items-center pt-5">
                  <label className="flex items-center gap-2 text-xs font-semibold cursor-pointer">
                    <input
                      type="checkbox"
                      checked={subPublish}
                      onChange={(e) => setSubPublish(e.target.checked)}
                      className="h-4 w-4 text-primary rounded"
                    />
                    <span>Xuất bản ngay</span>
                  </label>
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t">
                <button
                  type="button"
                  onClick={() => setSubjectModal({ open: false, mode: "create" })}
                  className="rounded-lg border px-4 py-2 text-xs font-medium hover:bg-accent"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="rounded-lg bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
                >
                  {saving ? "Đang lưu..." : "Lưu môn học"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ---------------- MODAL: SECTION ---------------- */}
      {sectionModal.open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-2xl bg-card p-6 shadow-xl border animate-fade-in space-y-4">
            <div className="flex items-center justify-between border-b pb-3">
              <h3 className="font-bold text-base text-foreground">
                {sectionModal.mode === "create" ? "Tạo phần mới" : "Chỉnh sửa phần"}
              </h3>
              <button
                onClick={() => setSectionModal({ open: false, mode: "create" })}
                className="text-muted-foreground hover:text-foreground"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleSaveSection} className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-foreground mb-1">
                  Tên phần <span className="text-destructive">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="Ví dụ: Chương 1 - Đạo hàm"
                  value={secTitle}
                  onChange={(e) => {
                    const val = e.target.value;
                    setSecTitle(val);
                    if (!secSlugManuallyEdited) {
                      setSecSlug(toSlug(val));
                    }
                  }}
                  className="w-full rounded-lg border bg-background px-3 py-2 text-xs outline-none focus:ring-2 focus:ring-primary/20"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-foreground mb-1">
                  Slug <span className="text-destructive">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="chuong-1-dao-ham"
                  value={secSlug}
                  onChange={(e) => {
                    setSecSlugManuallyEdited(true);
                    setSecSlug(toSlug(e.target.value));
                  }}
                  className="w-full rounded-lg border bg-background px-3 py-2 text-xs font-mono outline-none focus:ring-2 focus:ring-primary/20"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-foreground mb-1">
                  Phần cha (Có thể để trống nếu là Phần cấp 1)
                </label>
                <select
                  value={secParentId || ""}
                  onChange={(e) => setSecParentId(e.target.value || null)}
                  className="w-full rounded-lg border bg-background px-3 py-2 text-xs outline-none focus:ring-2 focus:ring-primary/20"
                >
                  <option value="">-- Không có (Phần cấp 1) --</option>
                  {sections
                    .filter(
                      (s) =>
                        s.subject_id === selectedSubjectId &&
                        s.id !== sectionModal.section?.id // Exclude self
                    )
                    .map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.title} ({s.slug})
                      </option>
                    ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-foreground mb-1">
                    Thứ tự (Sort order)
                  </label>
                  <input
                    type="number"
                    value={secSort}
                    onChange={(e) => setSecSort(parseInt(e.target.value, 10) || 0)}
                    className="w-full rounded-lg border bg-background px-3 py-1.5 text-xs outline-none focus:ring-2 focus:ring-primary/20"
                  />
                </div>

                <div className="flex items-center pt-5">
                  <label className="flex items-center gap-2 text-xs font-semibold cursor-pointer">
                    <input
                      type="checkbox"
                      checked={secPublish}
                      onChange={(e) => setSecPublish(e.target.checked)}
                      className="h-4 w-4 text-primary rounded"
                    />
                    <span>Xuất bản ngay</span>
                  </label>
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t">
                <button
                  type="button"
                  onClick={() => setSectionModal({ open: false, mode: "create" })}
                  className="rounded-lg border px-4 py-2 text-xs font-medium hover:bg-accent"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="rounded-lg bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
                >
                  {saving ? "Đang lưu..." : "Lưu phần"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ---------------- MODAL: QUIZ ---------------- */}
      {quizModal.open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-2xl bg-card p-6 shadow-xl border animate-fade-in space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b pb-3">
              <h3 className="font-bold text-base text-foreground">
                {quizModal.mode === "create" ? "Tạo Quiz mới" : "Chỉnh sửa Quiz"}
              </h3>
              <button
                onClick={() => setQuizModal({ open: false, mode: "create" })}
                className="text-muted-foreground hover:text-foreground"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleSaveQuiz} className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-foreground mb-1">
                  Tên Quiz <span className="text-destructive">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="Ví dụ: Quiz Luyện tập Đạo hàm #1"
                  value={quizTitle}
                  onChange={(e) => {
                    const val = e.target.value;
                    setQuizTitle(val);
                    if (!quizSlugManuallyEdited) {
                      setQuizSlug(toSlug(val));
                    }
                  }}
                  className="w-full rounded-lg border bg-background px-3 py-2 text-xs outline-none focus:ring-2 focus:ring-primary/20"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-foreground mb-1">
                  Slug <span className="text-destructive">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="quiz-luyen-tap-dao-ham-1"
                  value={quizSlug}
                  onChange={(e) => {
                    setQuizSlugManuallyEdited(true);
                    setQuizSlug(toSlug(e.target.value));
                  }}
                  className="w-full rounded-lg border bg-background px-3 py-2 text-xs font-mono outline-none focus:ring-2 focus:ring-primary/20"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-foreground mb-1">
                  Mô tả ngắn
                </label>
                <textarea
                  rows={2}
                  placeholder="Mô tả kiến thức cần kiểm tra..."
                  value={quizDesc}
                  onChange={(e) => setQuizDesc(e.target.value)}
                  className="w-full rounded-lg border bg-background px-3 py-2 text-xs outline-none focus:ring-2 focus:ring-primary/20"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-foreground mb-1">
                    Số câu mỗi lượt (1-300)
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={300}
                    value={quizQuestionLimit}
                    onChange={(e) => setQuizQuestionLimit(parseInt(e.target.value, 10) || 25)}
                    className="w-full rounded-lg border bg-background px-3 py-1.5 text-xs outline-none focus:ring-2 focus:ring-primary/20"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-foreground mb-1">
                    Thứ tự (Sort order)
                  </label>
                  <input
                    type="number"
                    value={quizSort}
                    onChange={(e) => setQuizSort(parseInt(e.target.value, 10) || 0)}
                    className="w-full rounded-lg border bg-background px-3 py-1.5 text-xs outline-none focus:ring-2 focus:ring-primary/20"
                  />
                </div>
              </div>

              <div className="space-y-2 pt-1">
                <label className="flex items-center gap-2 text-xs font-semibold cursor-pointer">
                  <input
                    type="checkbox"
                    checked={quizShuffleQuestions}
                    onChange={(e) => setQuizShuffleQuestions(e.target.checked)}
                    className="h-4 w-4 text-primary rounded"
                  />
                  <span>Đảo thứ tự câu hỏi khi làm quiz</span>
                </label>

                <label className="flex items-center gap-2 text-xs font-semibold cursor-pointer">
                  <input
                    type="checkbox"
                    checked={quizShuffleOptions}
                    onChange={(e) => setQuizShuffleOptions(e.target.checked)}
                    className="h-4 w-4 text-primary rounded"
                  />
                  <span>Đảo thứ tự phương án A/B/C/D</span>
                </label>

                <label className="flex items-center gap-2 text-xs font-semibold cursor-pointer">
                  <input
                    type="checkbox"
                    checked={quizPublish}
                    onChange={(e) => setQuizPublish(e.target.checked)}
                    className="h-4 w-4 text-primary rounded"
                  />
                  <span>Xuất bản ngay</span>
                </label>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t">
                <button
                  type="button"
                  onClick={() => setQuizModal({ open: false, mode: "create" })}
                  className="rounded-lg border px-4 py-2 text-xs font-medium hover:bg-accent"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="rounded-lg bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
                >
                  {saving ? "Đang lưu..." : "Lưu Quiz"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
