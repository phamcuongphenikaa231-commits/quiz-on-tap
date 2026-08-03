import { requireUserForApi } from "@/lib/auth/require-user";
import { requireDeviceForApi } from "@/lib/device/require-device";
import { createAdminClient } from "@/lib/supabase/admin";
import { jsonOk, jsonError } from "@/lib/api-response";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ attemptId: string; position: string }> }
) {
  try {
    const { attemptId, position: posStr } = await params;
    const position = parseInt(posStr, 10);

    if (isNaN(position) || position < 1) {
      return jsonError("INVALID_POSITION", "Vị trí câu hỏi không hợp lệ", 400);
    }

    const auth = await requireUserForApi();
    if (!auth) return jsonError("UNAUTHENTICATED", "Bạn chưa đăng nhập", 401);

    const deviceOk = await requireDeviceForApi();
    if (!deviceOk) {
      return jsonError("DEVICE_INACTIVE", "Thiết bị không hợp lệ", 403);
    }

    const admin = createAdminClient();

    // Kiểm tra attempt thuộc user
    const { data: attempt } = await admin
      .from("quiz_attempts")
      .select("id, user_id, total_questions, status")
      .eq("id", attemptId)
      .single();

    if (!attempt) {
      return jsonError("ATTEMPT_NOT_FOUND", "Phiên làm bài không tồn tại", 404);
    }

    if (attempt.user_id !== auth.user.id) {
      return jsonError("ATTEMPT_FORBIDDEN", "Phiên làm bài không thuộc về bạn", 403);
    }

    if (position > attempt.total_questions) {
      return jsonError("INVALID_POSITION", "Vượt quá số câu hỏi", 400);
    }

    // Lấy attempt_question
    const { data: aq } = await admin
      .from("attempt_questions")
      .select("question_id, option_order")
      .eq("attempt_id", attemptId)
      .eq("position", position)
      .single();

    if (!aq) {
      return jsonError("QUESTION_NOT_FOUND", "Không tìm thấy câu hỏi", 404);
    }

    // Lấy nội dung câu hỏi (CHỈ text, KHÔNG is_correct/explanation)
    const { data: question } = await admin
      .from("questions")
      .select("id, question_text")
      .eq("id", aq.question_id)
      .single();

    if (!question) {
      return jsonError("QUESTION_NOT_FOUND", "Không tìm thấy câu hỏi", 404);
    }

    // Lấy options theo thứ tự đã shuffle (CHỈ id, text)
    const optionOrder = aq.option_order as string[];
    const { data: allOptions } = await admin
      .from("options")
      .select("id, option_text")
      .in("id", optionOrder);

    // Sắp xếp theo option_order
    const options = optionOrder
      .map((id) => {
        const opt = (allOptions || []).find((o) => o.id === id);
        return opt ? { id: opt.id, text: opt.option_text } : null;
      })
      .filter((o): o is NonNullable<typeof o> => o !== null);

    // Kiểm tra đã trả lời chưa
    const { data: existingAnswer } = await admin
      .from("attempt_answers")
      .select("id")
      .eq("attempt_id", attemptId)
      .eq("question_id", aq.question_id)
      .maybeSingle();

    return jsonOk({
      attemptId,
      position,
      total: attempt.total_questions,
      questionId: question.id,
      questionText: question.question_text,
      options,
      answered: !!existingAnswer,
    });
  } catch {
    return jsonError("INTERNAL_ERROR", "Lỗi hệ thống", 500);
  }
}
