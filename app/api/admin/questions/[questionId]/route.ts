import { requireAdminForApi } from "@/lib/auth/require-admin";
import { createAdminClient } from "@/lib/supabase/admin";
import { jsonOk, jsonError } from "@/lib/api-response";
import { questionSchema } from "@/lib/import/question-schema";

export const dynamic = "force-dynamic";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ questionId: string }> }
) {
  const auth = await requireAdminForApi();
  if (!auth) return jsonError("FORBIDDEN", "Không có quyền quản trị", 403);

  const { questionId } = await params;

  try {
    const body = await request.json();
    const parseResult = questionSchema.safeParse(body);

    if (!parseResult.success) {
      const issues = parseResult.error.issues.map((i) => i.message);
      return jsonError("VALIDATION_ERROR", issues.join("; "), 400);
    }

    const { questionText, generalExplanation, sortOrder, options } = parseResult.data;
    const admin = createAdminClient();

    // Update question
    const { error: qError } = await admin
      .from("questions")
      .update({
        question_text: questionText,
        general_explanation: generalExplanation,
        sort_order: sortOrder,
      })
      .eq("id", questionId);

    if (qError) {
      return jsonError("UPDATE_FAILED", `Lỗi cập nhật câu hỏi: ${qError.message}`, 500);
    }

    // Replace options
    await admin.from("options").delete().eq("question_id", questionId);

    const optionsToInsert = options.map((opt, idx) => ({
      question_id: questionId,
      option_text: opt.text,
      explanation: opt.explanation,
      is_correct: opt.isCorrect,
      sort_order: opt.sortOrder ?? idx + 1,
    }));

    const { error: optError } = await admin.from("options").insert(optionsToInsert);

    if (optError) {
      return jsonError("OPTION_UPDATE_FAILED", `Lỗi cập nhật phương án: ${optError.message}`, 500);
    }

    return jsonOk({ message: "Cập nhật câu hỏi thành công" });
  } catch (err) {
    return jsonError(
      "INTERNAL_ERROR",
      `Lỗi máy chủ: ${err instanceof Error ? err.message : "Unknown"}`,
      500
    );
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ questionId: string }> }
) {
  const auth = await requireAdminForApi();
  if (!auth) return jsonError("FORBIDDEN", "Không có quyền quản trị", 403);

  const { questionId } = await params;
  const admin = createAdminClient();

  const { error } = await admin.from("questions").delete().eq("id", questionId);

  if (error) {
    return jsonError("DELETE_FAILED", `Không thể xóa câu hỏi: ${error.message}`, 500);
  }

  return jsonOk({ message: "Đã xóa câu hỏi thành công" });
}
