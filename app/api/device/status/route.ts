import { createClient } from "@/lib/supabase/server";
import { getDeviceCookieToken, hashDeviceToken } from "@/lib/device/device-cookie";
import { jsonOk, jsonError } from "@/lib/api-response";
import { isDeviceLimitBypassed } from "@/lib/device/device-limit-config";

export async function GET() {
  try {
    const supabase = await createClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return jsonError("UNAUTHENTICATED", "Bạn chưa đăng nhập", 401);
    }

    // ── Bypass giới hạn thiết bị trong môi trường development ──────────────
    // Auth vẫn bắt buộc (kiểm tra ở trên rồi mới tới đây).
    if (isDeviceLimitBypassed()) {
      console.info("[Device Limit] Bypassed in local development (status)");
      return jsonOk({ active: true, bypassed: true });
    }
    // ────────────────────────────────────────────────────────────────────────

    const rawToken = await getDeviceCookieToken();
    if (!rawToken) {
      return jsonOk({ active: false });
    }

    const hash = hashDeviceToken(rawToken);

    const { data, error } = await supabase.rpc("is_current_device_active", {
      p_device_token_hash: hash,
    });

    if (error) {
      return jsonError("RPC_ERROR", "Lỗi hệ thống", 500);
    }

    return jsonOk({ active: data === true });
  } catch {
    return jsonError("INTERNAL_ERROR", "Lỗi hệ thống", 500);
  }
}
