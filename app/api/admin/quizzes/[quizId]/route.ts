import { requireAdminForApi } from "@/lib/auth/require-admin";
import { createAdminClient } from "@/lib/supabase/admin";
import { jsonOk, jsonError } from "@/lib/api-response";
import { updateQuizSchema } from "@/lib/content/schemas";

export const dynamic = "force-dynamic";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ quizId: string }> }
) {
  const auth = await requireAdminForApi();
  if (!auth) return jsonError("FORBIDDEN", "Không có quyền quản trị", 403);

  const { quizId } = await params;

  try {
    const body = await request.json();
    const parsed = updateQuizSchema.safeParse(body);
    if (!parsed.success) {
      const msg = parsed.error.issues.map((i) => i.message).join("; ");
      return jsonError("VALIDATION_ERROR", msg, 400);
    }

    const admin = createAdminClient();
    const d = parsed.data;

    // Get current quiz for subject_id
    const { data: current } = await admin
      .from("quizzes")
      .select("id, subject_id")
      .eq("id", quizId)
      .single();

    if (!current) return jsonError("NOT_FOUND", "Không tìm thấy quiz", 404);

    // Check slug duplicate
    if (d.slug) {
      const { data: existing } = await admin
        .from("quizzes")
        .select("id")
        .eq("subject_id", current.subject_id)
        .eq("slug", d.slug)
        .neq("id", quizId)
        .maybeSingle();

      if (existing) {
        return jsonError("SLUG_DUPLICATE", `Slug "${d.slug}" đã tồn tại trong môn này.`, 409);
      }
    }

    const updates: Record<string, unknown> = {};
    if (d.title !== undefined) updates.title = d.title;
    if (d.slug !== undefined) updates.slug = d.slug;
    if (d.description !== undefined) updates.description = d.description;
    if (d.questionLimit !== undefined) updates.question_limit = d.questionLimit;
    if (d.shuffleQuestions !== undefined) updates.shuffle_questions = d.shuffleQuestions;
    if (d.shuffleOptions !== undefined) updates.shuffle_options = d.shuffleOptions;
    if (d.sortOrder !== undefined) updates.sort_order = d.sortOrder;
    if (d.isPublished !== undefined) updates.is_published = d.isPublished;

    if (Object.keys(updates).length === 0) {
      return jsonError("NO_CHANGES", "Không có thay đổi nào", 400);
    }

    const { data, error } = await admin
      .from("quizzes")
      .update(updates)
      .eq("id", quizId)
      .select("id, title, slug")
      .single();

    if (error) return jsonError("UPDATE_FAILED", `Lỗi cập nhật: ${error.message}`, 500);
    return jsonOk(data);
  } catch {
    return jsonError("INTERNAL_ERROR", "Lỗi hệ thống", 500);
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ quizId: string }> }
) {
  const auth = await requireAdminForApi();
  if (!auth) return jsonError("FORBIDDEN", "Không có quyền quản trị", 403);

  const { quizId } = await params;
  const admin = createAdminClient();

  const { error } = await admin
    .from("quizzes")
    .delete()
    .eq("id", quizId);

  if (error) return jsonError("DELETE_FAILED", `Lỗi xóa quiz: ${error.message}`, 500);
  return jsonOk({ message: "Đã xóa quiz thành công" });
}
