import { requireAdminForApi } from "@/lib/auth/require-admin";
import { createAdminClient } from "@/lib/supabase/admin";
import { jsonOk, jsonError } from "@/lib/api-response";
import { createQuizSchema } from "@/lib/content/schemas";

export const dynamic = "force-dynamic";

export async function GET() {
  const auth = await requireAdminForApi();
  if (!auth) return jsonError("FORBIDDEN", "Không có quyền quản trị", 403);

  const admin = createAdminClient();

  // Fetch subjects with sections and quizzes
  const { data: subjects, error: subErr } = await admin
    .from("subjects")
    .select("id, title, slug, sort_order")
    .order("sort_order", { ascending: true });

  if (subErr) {
    return jsonError("FETCH_FAILED", "Không thể lấy danh sách môn học", 500);
  }

  const { data: sections, error: secErr } = await admin
    .from("sections")
    .select("id, subject_id, parent_id, title, slug, sort_order")
    .order("sort_order", { ascending: true });

  if (secErr) {
    return jsonError("FETCH_FAILED", "Không thể lấy danh sách phần", 500);
  }

  const { data: quizzes, error: quizErr } = await admin
    .from("quizzes")
    .select("id, subject_id, section_id, title, slug, sort_order, questions(count)")
    .order("sort_order", { ascending: true });

  if (quizErr) {
    return jsonError("FETCH_FAILED", "Không thể lấy danh sách quiz", 500);
  }

  const formattedQuizzes = quizzes.map((q) => {
    const qCount = Array.isArray(q.questions)
      ? (q.questions[0] as { count: number })?.count || 0
      : 0;
    return {
      id: q.id,
      subjectId: q.subject_id,
      sectionId: q.section_id,
      title: q.title,
      slug: q.slug,
      questionCount: qCount,
    };
  });

  return jsonOk({
    subjects: subjects || [],
    sections: sections || [],
    quizzes: formattedQuizzes || [],
  });
}

export async function POST(request: Request) {
  const auth = await requireAdminForApi();
  if (!auth) return jsonError("FORBIDDEN", "Không có quyền quản trị", 403);

  try {
    const body = await request.json();
    const parsed = createQuizSchema.safeParse(body);
    if (!parsed.success) {
      const msg = parsed.error.issues.map((i) => i.message).join("; ");
      return jsonError("VALIDATION_ERROR", msg, 400);
    }

    const d = parsed.data;
    const admin = createAdminClient();

    // Check slug duplicate within same subject
    const { data: existing } = await admin
      .from("quizzes")
      .select("id")
      .eq("subject_id", d.subjectId)
      .eq("slug", d.slug)
      .maybeSingle();

    if (existing) {
      return jsonError("SLUG_DUPLICATE", `Slug "${d.slug}" đã tồn tại trong môn này. Vui lòng chọn slug khác.`, 409);
    }

    const { data, error } = await admin
      .from("quizzes")
      .insert({
        subject_id: d.subjectId,
        section_id: d.sectionId,
        title: d.title,
        slug: d.slug,
        description: d.description || "",
        question_limit: d.questionLimit ?? 25,
        shuffle_questions: d.shuffleQuestions ?? true,
        shuffle_options: d.shuffleOptions ?? true,
        sort_order: d.sortOrder ?? 0,
        is_published: d.isPublished ?? false,
      })
      .select("id, title, slug")
      .single();

    if (error) return jsonError("INSERT_FAILED", `Lỗi tạo quiz: ${error.message}`, 500);
    return jsonOk(data, 201);
  } catch {
    return jsonError("INTERNAL_ERROR", "Lỗi hệ thống", 500);
  }
}

