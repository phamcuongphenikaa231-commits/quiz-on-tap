import { createClient } from "@/lib/supabase/server";
import { getDeviceCookieToken, hashDeviceToken } from "@/lib/device/device-cookie";
import { jsonOk, jsonError } from "@/lib/api-response";
import { z } from "zod";

const startSchema = z.object({
  forceNew: z.boolean().optional().default(false),
});

export async function POST(
  request: Request,
  { params }: { params: Promise<{ quizId: string }> }
) {
  const startedAt = performance.now();
  try {
    const { quizId } = await params;
    let forceNew = false;

    // Read and parse optional body
    try {
      const text = await request.text();
      if (text && text.trim().length > 0) {
        const json = JSON.parse(text);
        const parsed = startSchema.safeParse(json);
        if (parsed.success) {
          forceNew = parsed.data.forceNew;
        }
      }
    } catch {
      // If parsing fails or body empty, default forceNew to false
      forceNew = false;
    }

    const rawToken = await getDeviceCookieToken();
    const hash = rawToken ? hashDeviceToken(rawToken) : "";

    const supabase = await createClient();

    // Call fast RPC with forceNew flag
    const { data: rpcResult, error: rpcError } = await supabase.rpc(
      "start_quiz_attempt_fast",
      {
        p_quiz_id: quizId,
        p_device_token_hash: hash,
        p_force_new: forceNew,
      }
    );

    console.log({
      route: "POST /api/quizzes/[quizId]/start",
      forceNew,
      durationMs: Math.round(performance.now() - startedAt),
    });

    if (rpcError) {
      console.error("Restart quiz RPC error", {
        code: rpcError.code,
        message: rpcError.message,
        details: (rpcError as { details?: string }).details,
        hint: (rpcError as { hint?: string }).hint,
      });
      return jsonError("RPC_ERROR", rpcError.message || "Lỗi khởi tạo bài làm", 500);
    }

    const result = rpcResult as {
      ok: boolean;
      code?: string;
      message?: string;
      data?: {
        attemptId: string;
        total: number;
        totalQuestions: number;
        questions: Array<{
          position: number;
          questionId: string;
          questionText: string;
          options: Array<{ id: string; text: string }>;
          answered?: boolean;
          selectedOptionId?: string | null;
        }>;
      };
    };

    if (!result.ok) {
      const status =
        result.code === "UNAUTHENTICATED"
          ? 401
          : result.code === "DEVICE_INACTIVE" ||
            result.code === "ACCOUNT_BLOCKED" ||
            result.code === "NO_SUBJECT_ACCESS" ||
            result.code === "QUIZ_NOT_PUBLISHED"
          ? 403
          : result.code === "QUIZ_NOT_FOUND"
          ? 404
          : 400;

      return jsonError(result.code || "START_ERROR", result.message || "Không thể bắt đầu quiz", status);
    }

    return jsonOk(result.data);
  } catch {
    console.log({
      route: "POST /api/quizzes/[quizId]/start",
      durationMs: Math.round(performance.now() - startedAt),
    });
    return jsonError("INTERNAL_ERROR", "Lỗi hệ thống", 500);
  }
}
