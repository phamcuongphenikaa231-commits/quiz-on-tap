import { requireUser } from "@/lib/auth/require-user";
import { requireDevice } from "@/lib/device/require-device";
import { SectionTree } from "@/components/section-tree";
import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { unstable_cache } from "next/cache";
import { MusicTopbarButton } from "@/components/music/music-topbar-button";

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

  for (const section of sectionMap.values()) {
    section.quizzes.sort((a, b) => {
      const qa = quizzes.find((q) => q.id === a.id);
      const qb = quizzes.find((q) => q.id === b.id);
      return (qa?.sort_order || 0) - (qb?.sort_order || 0);
    });
  }

  const roots: Section[] = [];
  for (const section of sectionMap.values()) {
    if (section.parent_id && sectionMap.has(section.parent_id)) {
      sectionMap.get(section.parent_id)!.children.push(section);
    } else {
      roots.push(section);
    }
  }

  function sortChildren(nodes: Section[]) {
    nodes.sort((a, b) => a.sort_order - b.sort_order);
    for (const node of nodes) {
      sortChildren(node.children);
    }
  }

  sortChildren(roots);
  return roots;
}

/**
  * Cache subject structure (sections, quizzes, question counts) by subjectId.
  * Avoids repetitive database hits for static course structures.
  */
const getSubjectTreeCached = (subjectId: string) =>
  unstable_cache(
    async () => {
      const { createAdminClient } = await import("@/lib/supabase/admin");
      const adminClient = createAdminClient();

      const [sectionsRes, quizzesRes] = await Promise.all([
        adminClient
          .from("sections")
          .select("id, title, parent_id, sort_order")
          .eq("subject_id", subjectId)
          .eq("is_published", true)
          .order("sort_order"),
        adminClient
          .from("quizzes")
          .select("id, title, section_id, sort_order")
          .eq("subject_id", subjectId)
          .eq("is_published", true)
          .order("sort_order"),
      ]);

      const sections = sectionsRes.data || [];
      const quizzes = quizzesRes.data || [];

      // Single grouped question count query instead of N+1 loop
      const questionCounts: Record<string, number> = {};
      const quizIds = quizzes.map((q) => q.id);

      if (quizIds.length > 0) {
        const { data: qRows } = await adminClient
          .from("questions")
          .select("quiz_id")
          .in("quiz_id", quizIds)
          .eq("is_active", true);

        for (const row of qRows || []) {
          questionCounts[row.quiz_id] = (questionCounts[row.quiz_id] || 0) + 1;
        }
      }

      return buildSectionTree(
        sections as SectionRow[],
        quizzes as QuizRow[],
        questionCounts
      );
    },
    [`subject-tree-${subjectId}`],
    {
      revalidate: 60,
      tags: [`subject-${subjectId}`],
    }
  )();

export default async function SubjectPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const startedAt = performance.now();
  const { slug } = await params;
  const { user, supabase } = await requireUser();
  await requireDevice();

  // Parallel fetch subject & access check
  const { data: subject } = await supabase
    .from("subjects")
    .select("id, title, slug, description")
    .eq("slug", slug)
    .eq("is_published", true)
    .single();

  if (!subject) {
    notFound();
  }

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

  const tree = await getSubjectTreeCached(subject.id);

  console.log({
    route: `/mon/${slug}`,
    durationMs: Math.round(performance.now() - startedAt),
  });

  return (
    <div className="min-h-screen bg-background">
      <header data-floating-obstacle="topbar" className="sticky top-0 z-40 border-b bg-card/80 backdrop-blur-sm">
        <div className="mx-auto flex max-w-3xl items-center justify-between gap-3 px-4 py-3">
          <Link
            href="/dashboard"
            className="flex shrink-0 items-center gap-1 text-sm text-muted-foreground transition-colors hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" />
            <span className="hidden sm:inline">Quay lại</span>
          </Link>
          <h1 className="flex-1 min-w-0 font-semibold text-foreground truncate">
            {subject.title}
          </h1>
          <MusicTopbarButton />
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
