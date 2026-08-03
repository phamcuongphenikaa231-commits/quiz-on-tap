import { requireAdminForApi } from "@/lib/auth/require-admin";
import { createAdminClient } from "@/lib/supabase/admin";
import { jsonOk, jsonError } from "@/lib/api-response";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ userId: string }> }
) {
  const auth = await requireAdminForApi();
  if (!auth) return jsonError("FORBIDDEN", "Không có quyền quản trị", 403);

  try {
    const { userId } = await params;
    const body = await request.json();
    const { status } = body;

    if (!["active", "blocked"].includes(status)) {
      return jsonError("INVALID_STATUS", "Trạng thái không hợp lệ", 400);
    }

    // Tránh admin tự khóa tài khoản của mình mà không xác nhận
    if (userId === auth.user.id && status === "blocked") {
      const { confirmSelfBlock } = body;
      if (!confirmSelfBlock) {
        return jsonError(
          "SELF_BLOCK_WARNING",
          "Bạn đang tự khóa tài khoản của chính mình. Vui lòng xác nhận.",
          400
        );
      }
    }

    const admin = createAdminClient();

    const { error: updateError } = await admin
      .from("profiles")
      .update({ status })
      .eq("id", userId);

    if (updateError) {
      return jsonError("UPDATE_FAILED", "Không thể cập nhật trạng thái", 500);
    }

    return jsonOk({ userId, status });
  } catch {
    return jsonError("INTERNAL_ERROR", "Lỗi hệ thống", 500);
  }
}
