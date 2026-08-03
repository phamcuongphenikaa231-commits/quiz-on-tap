import { requireUserForApi } from "@/lib/auth/require-user";
import { requireDeviceForApi } from "@/lib/device/require-device";
import { createAdminClient } from "@/lib/supabase/admin";
import { jsonOk, jsonError } from "@/lib/api-response";
import { answerSchema } from "@/lib/quiz/validators";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ attemptId: string }> }
) {
  try {
    const { attemptId } = await params;
    const auth = await requireUserForApi();
    if (!auth) return jsonError("UNAUTHENTICATED", "Bạn chưa đăng nhập", 401);

    const deviceOk = await requireDeviceForApi();
    if (!deviceOk) {
      return jsonError("DEVICE_INACTIVE", "Thiết bị không hợp lệ", 403);
    }

    // Parse and validate body
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return jsonError("INVALID_BODY", "Body không hợp lệ", 400);
    }

    const parsed = answerSchema.safeParse(body);
    if (!parsed.success) {
      const firstError = parsed.error.issues[0]?.message || "Dữ liệu không hợp lệ";
      return jsonError("VALIDATION_ERROR", firstError, 400);
    }

    const { questionId, selectedOptionId } = parsed.data;
    const admin = createAdminClient();

    // Kiểm tra attempt thuộc user và chưa hoàn tất
    const { data: attempt } = await admin
      .from("quiz_attempts")
      .select("id, user_id, status")
      .eq("id", attemptId)
      .single();

    if (!attempt) {
      return jsonError("ATTEMPT_NOT_FOUND", "Phiên làm bài không tồn tại", 404);
    }

    if (attempt.user_id !== auth.user.id) {
      return jsonError("ATTEMPT_FORBIDDEN", "Phiên làm bài không thuộc về bạn", 403);
    }

    if (attempt.status === "completed") {
      return jsonError("ATTEMPT_COMPLETED", "Phiên làm bài đã kết thúc", 400);
    }

    // Kiểm tra question nằm trong attempt
    const { data: aq } = await admin
      .from("attempt_questions")
      .select("question_id")
      .eq("attempt_id", attemptId)
      .eq("question_id", questionId)
      .single();

    if (!aq) {
      return jsonError("QUESTION_NOT_IN_ATTEMPT", "Câu hỏi không thuộc phiên làm bài này", 400);
    }

    // Kiểm tra option thuộc đúng question
    const { data: selectedOption } = await admin
      .from("options")
      .select("id, question_id, is_correct")
      .eq("id", selectedOptionId)
      .single();

    if (!selectedOption || selectedOption.question_id !== questionId) {
      return jsonError("OPTION_NOT_IN_QUESTION", "Lựa chọn không thuộc câu hỏi này", 400);
    }

    // Kiểm tra chưa trả lời câu này
    const { data: existingAnswer } = await admin
      .from("attempt_answers")
      .select("id")
      .eq("attempt_id", attemptId)
      .eq("question_id", questionId)
      .maybeSingle();

    if (existingAnswer) {
      return jsonError("ALREADY_ANSWERED", "Câu hỏi này đã được trả lời", 400);
    }

    // Ghi answer
    const isCorrect = selectedOption.is_correct;
    const { error: insertError } = await admin
      .from("attempt_answers")
      .insert({
        attempt_id: attemptId,
        question_id: questionId,
        selected_option_id: selectedOptionId,
        is_correct: isCorrect,
      });

    if (insertError) {
      return jsonError("INSERT_ERROR", "Không thể lưu câu trả lời", 500);
    }

    // Lấy thông tin để trả về (SAU KHI đã trả lời)
    const { data: question } = await admin
      .from("questions")
      .select("general_explanation")
      .eq("id", questionId)
      .single();

    const { data: allOptions } = await admin
      .from("options")
      .select("id, is_correct, explanation")
      .eq("question_id", questionId)
      .order("sort_order");

    const correctOption = (allOptions || []).find((o) => o.is_correct);

    return jsonOk({
      isCorrect,
      correctOptionId: correctOption?.id || "",
      selectedOptionId,
      generalExplanation: question?.general_explanation || "",
      options: (allOptions || []).map((o) => ({
        id: o.id,
        isCorrect: o.is_correct,
        explanation: o.explanation,
      })),
    });
  } catch {
    return jsonError("INTERNAL_ERROR", "Lỗi hệ thống", 500);
  }
}
