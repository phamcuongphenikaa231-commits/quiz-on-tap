import { requireAdminForApi } from "@/lib/auth/require-admin";
import { createAdminClient } from "@/lib/supabase/admin";
import { jsonOk, jsonError } from "@/lib/api-response";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ userId: string }> }
) {
  const auth = await requireAdminForApi();
  if (!auth) return jsonError("FORBIDDEN", "Không có quyền quản trị", 403);

  try {
    const { userId } = await params;
    const admin = createAdminClient();

    // Gọi RPC admin_reset_user_devices
    const { data: count, error } = await admin.rpc("admin_reset_user_devices", {
      p_user_id: userId,
    });

    if (error) {
      // Nếu RPC bị fail do RLS vì RPC dùng SECURITY DEFINER kiểm tra is_admin(),
      // hãy chắc chắn RPC thực thi đúng. Thử fallback delete nếu RPC fail.
      const { error: deleteError } = await admin
        .from("user_devices")
        .delete()
        .eq("user_id", userId);

      if (deleteError) {
        return jsonError("RESET_FAILED", "Không thể reset thiết bị", 500);
      }
      return jsonOk({ resetCount: 0 });
    }

    return jsonOk({ resetCount: count });
  } catch {
    return jsonError("INTERNAL_ERROR", "Lỗi hệ thống", 500);
  }
}
