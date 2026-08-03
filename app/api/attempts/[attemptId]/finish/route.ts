import { requireUserForApi } from "@/lib/auth/require-user";
import { requireDeviceForApi } from "@/lib/device/require-device";
import { createAdminClient } from "@/lib/supabase/admin";
import { jsonOk, jsonError } from "@/lib/api-response";

export async function POST(
  _request: Request,
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

    const admin = createAdminClient();

    // Kiểm tra attempt thuộc user
    const { data: attempt } = await admin
      .from("quiz_attempts")
      .select("id, user_id, status, total_questions")
      .eq("id", attemptId)
      .single();

    if (!attempt) {
      return jsonError("ATTEMPT_NOT_FOUND", "Phiên làm bài không tồn tại", 404);
    }

    if (attempt.user_id !== auth.user.id) {
      return jsonError("ATTEMPT_FORBIDDEN", "Phiên làm bài không thuộc về bạn", 403);
    }

    if (attempt.status === "completed") {
      // Trả lại kết quả nếu đã hoàn tất
      return jsonOk({
        totalQuestions: attempt.total_questions,
        correctCount: 0,
        score: 0,
      });
    }

    // Tính điểm từ database (KHÔNG nhận từ client)
    const { data: answers } = await admin
      .from("attempt_answers")
      .select("is_correct")
      .eq("attempt_id", attemptId);

    const correctCount = (answers || []).filter((a) => a.is_correct).length;
    const score =
      attempt.total_questions > 0
        ? Math.round((correctCount / attempt.total_questions) * 10000) / 100
        : 0;

    // Cập nhật attempt
    const { error: updateError } = await admin
      .from("quiz_attempts")
      .update({
        status: "completed",
        correct_count: correctCount,
        score,
        completed_at: new Date().toISOString(),
      })
      .eq("id", attemptId);

    if (updateError) {
      return jsonError("UPDATE_ERROR", "Không thể cập nhật kết quả", 500);
    }

    return jsonOk({
      totalQuestions: attempt.total_questions,
      correctCount,
      score,
    });
  } catch {
    return jsonError("INTERNAL_ERROR", "Lỗi hệ thống", 500);
  }
}
