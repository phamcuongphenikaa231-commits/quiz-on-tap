import { requireUser } from "@/lib/auth/require-user";
import { requireDevice } from "@/lib/device/require-device";
import { SectionTree } from "@/components/section-tree";
import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

export const dynamic = "force-dynamic";

interface Section {
  id: string;
  title: string;
  parent_id: string | null;
  sort_order: number;
  children: Section[];
  quizzes: Quiz[];
}

interface Quiz {
  id: string;
  title: string;
  question_count: number;
}

interface SectionRow {
  id: string;
  title: string;
  parent_id: string | null;
  sort_order: number;
}

interface QuizRow {
  id: string;
  title: string;
  section_id: string;
  sort_order: number;
}

function buildSectionTree(
  sections: SectionRow[],
  quizzes: QuizRow[],
  questionCounts: Record<string, number>
): Section[] {
  const sectionMap = new Map<string, Section>();

  // Create section nodes
  for (const s of sections) {
    sectionMap.set(s.id, {
      id: s.id,
      title: s.title,
      parent_id: s.parent_id,
      sort_order: s.sort_order,
      children: [],
      quizzes: [],
    });
  }

  // Attach quizzes to sections
  for (const q of quizzes) {
    const section = sectionMap.get(q.section_id);
    if (section) {
      section.quizzes.push({
        id: q.id,
        title: q.title,
        question_count: questionCounts[q.id] || 0,
      });
    }
  }

  // Sort quizzes within sections
  for (const section of sectionMap.values()) {
    section.quizzes.sort((a, b) => {
      const qa = quizzes.find((q) => q.id === a.id);
      const qb = quizzes.find((q) => q.id === b.id);
      return (qa?.sort_order || 0) - (qb?.sort_order || 0);
    });
  }

  // Build tree
  const roots: Section[] = [];
  for (const section of sectionMap.values()) {
    if (section.parent_id && sectionMap.has(section.parent_id)) {
      sectionMap.get(section.parent_id)!.children.push(section);
    } else {
      roots.push(section);
    }
  }

  // Sort children recursively
  function sortChildren(nodes: Section[]) {
    nodes.sort((a, b) => a.sort_order - b.sort_order);
    for (const node of nodes) {
      sortChildren(node.children);
    }
  }

  sortChildren(roots);
  return roots;
}

export default async function SubjectPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const { user, supabase } = await requireUser();
  await requireDevice();

  // Kiểm tra quyền truy cập môn
  const { data: subject } = await supabase
    .from("subjects")
    .select("id, title, slug, description")
    .eq("slug", slug)
    .eq("is_published", true)
    .single();

  if (!subject) {
    notFound();
  }

  // Kiểm tra user_subjects
  const { data: access } = await supabase
    .from("user_subjects")
    .select("is_active")
    .eq("user_id", user.id)
    .eq("subject_id", subject.id)
    .eq("is_active", true)
    .single();

  if (!access) {
    notFound();
  }

  // Lấy sections
  const { data: sections } = await supabase
    .from("sections")
    .select("id, title, parent_id, sort_order")
    .eq("subject_id", subject.id)
    .eq("is_published", true)
    .order("sort_order");

  // Lấy quizzes
  const { data: quizzes } = await supabase
    .from("quizzes")
    .select("id, title, section_id, sort_order")
    .eq("subject_id", subject.id)
    .eq("is_published", true)
    .order("sort_order");

  // Đếm câu hỏi cho mỗi quiz (dùng admin client vì questions bị RLS chặn student)
  // Sử dụng count qua relationship
  const questionCounts: Record<string, number> = {};
  if (quizzes && quizzes.length > 0) {
    const { createAdminClient } = await import("@/lib/supabase/admin");
    const adminClient = createAdminClient();

    for (const quiz of quizzes) {
      const { count } = await adminClient
        .from("questions")
        .select("id", { count: "exact", head: true })
        .eq("quiz_id", quiz.id)
        .eq("is_active", true);
      questionCounts[quiz.id] = count || 0;
    }
  }

  const tree = buildSectionTree(
    (sections || []) as SectionRow[],
    (quizzes || []) as QuizRow[],
    questionCounts
  );

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-40 border-b bg-card/80 backdrop-blur-sm">
        <div className="mx-auto flex max-w-3xl items-center gap-3 px-4 py-3">
          <Link
            href="/dashboard"
            className="flex items-center gap-1 text-sm text-muted-foreground transition-colors hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" />
            <span className="hidden sm:inline">Quay lại</span>
          </Link>
          <h1 className="font-semibold text-foreground truncate">
            {subject.title}
          </h1>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-4 py-6">
        {subject.description && (
          <p className="mb-6 text-sm text-muted-foreground">
            {subject.description}
          </p>
        )}
        <SectionTree sections={tree} />
      </main>
    </div>
  );
}
