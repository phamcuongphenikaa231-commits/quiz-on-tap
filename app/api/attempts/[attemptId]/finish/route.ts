import { createClient } from "@/lib/supabase/server";
import { getDeviceCookieToken, hashDeviceToken } from "@/lib/device/device-cookie";
import { jsonOk, jsonError } from "@/lib/api-response";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ attemptId: string }> }
) {
  const startedAt = performance.now();
  try {
    const { attemptId } = await params;
    const rawToken = await getDeviceCookieToken();
    const hash = rawToken ? hashDeviceToken(rawToken) : "";

    const supabase = await createClient();

    const { data: rpcResult, error: rpcError } = await supabase.rpc(
      "finish_quiz_attempt_fast",
      {
        p_attempt_id: attemptId,
        p_device_token_hash: hash,
      }
    );

    console.log({
      route: "POST /api/attempts/[attemptId]/finish",
      durationMs: Math.round(performance.now() - startedAt),
    });

    if (rpcError) {
      return jsonError("RPC_ERROR", rpcError.message || "Lỗi hoàn tất bài làm", 500);
    }

    const result = rpcResult as {
      ok: boolean;
      code?: string;
      message?: string;
      data?: {
        totalQuestions: number;
        correctCount: number;
        score: number;
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

      return jsonError(result.code || "FINISH_ERROR", result.message || "Không thể hoàn tất bài làm", status);
    }

    return jsonOk(result.data);
  } catch {
    console.log({
      route: "POST /api/attempts/[attemptId]/finish",
      durationMs: Math.round(performance.now() - startedAt),
    });
    return jsonError("INTERNAL_ERROR", "Lỗi hệ thống", 500);
  }
}
