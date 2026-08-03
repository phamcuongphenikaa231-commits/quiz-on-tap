import { requireAdminForApi } from "@/lib/auth/require-admin";
import { createAdminClient } from "@/lib/supabase/admin";
import { jsonOk, jsonError } from "@/lib/api-response";

export const dynamic = "force-dynamic";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ quizId: string }> }
) {
  const auth = await requireAdminForApi();
  if (!auth) return jsonError("FORBIDDEN", "Không có quyền quản trị", 403);

  const { quizId } = await params;
  const { searchParams } = new URL(request.url);
  const search = (searchParams.get("search") || "").trim();

  const admin = createAdminClient();

  let query = admin
    .from("questions")
    .select(
      `
      id,
      quiz_id,
      question_text,
      general_explanation,
      sort_order,
      created_at,
      options (
        id,
        option_text,
        explanation,
        is_correct,
        sort_order
      )
    `
    )
    .eq("quiz_id", quizId)
    .order("sort_order", { ascending: true });

  if (search) {
    query = query.ilike("question_text", `%${search}%`);
  }

  const { data: questions, error } = await query;

  if (error) {
    return jsonError("FETCH_FAILED", `Không thể lấy danh sách câu hỏi: ${error.message}`, 500);
  }

  // Sort options inside each question
  const formatted = (questions || []).map((q) => ({
    ...q,
    options: (q.options || []).sort((a, b) => a.sort_order - b.sort_order),
  }));

  return jsonOk(formatted);
}
