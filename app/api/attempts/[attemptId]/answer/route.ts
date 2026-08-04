import { createClient } from "@/lib/supabase/server";
import { getDeviceCookieToken, hashDeviceToken } from "@/lib/device/device-cookie";
import { jsonOk, jsonError } from "@/lib/api-response";
import { answerSchema } from "@/lib/quiz/validators";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ attemptId: string }> }
) {
  const startedAt = performance.now();
  try {
    const { attemptId } = await params;

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
    const rawToken = await getDeviceCookieToken();
    const hash = rawToken ? hashDeviceToken(rawToken) : "";

    const supabase = await createClient();

    const { data: rpcResult, error: rpcError } = await supabase.rpc(
      "submit_quiz_answer_fast",
      {
        p_attempt_id: attemptId,
        p_question_id: questionId,
        p_selected_option_id: selectedOptionId,
        p_device_token_hash: hash,
      }
    );

    console.log({
      route: "POST /api/attempts/[attemptId]/answer",
      durationMs: Math.round(performance.now() - startedAt),
    });

    if (rpcError) {
      return jsonError("RPC_ERROR", rpcError.message || "Lỗi nộp đáp án", 500);
    }

    const result = rpcResult as {
      ok: boolean;
      code?: string;
      message?: string;
      data?: {
        isCorrect: boolean;
        correctOptionId: string;
        selectedOptionId: string;
        options: Array<{
          id: string;
          isCorrect: boolean;
          explanation: string;
        }>;
      };
    };

    if (!result.ok) {
      const status =
        result.code === "UNAUTHENTICATED"
          ? 401
          : result.code === "DEVICE_INACTIVE" ||
            result.code === "ACCOUNT_BLOCKED" ||
            result.code === "ATTEMPT_FORBIDDEN"
          ? 403
          : result.code === "ATTEMPT_NOT_FOUND"
          ? 404
          : 400;

      return jsonError(result.code || "ANSWER_ERROR", result.message || "Không thể lưu đáp án", status);
    }

    return jsonOk(result.data);
  } catch {
    console.log({
      route: "POST /api/attempts/[attemptId]/answer",
      durationMs: Math.round(performance.now() - startedAt),
    });
    return jsonError("INTERNAL_ERROR", "Lỗi hệ thống", 500);
  }
}
