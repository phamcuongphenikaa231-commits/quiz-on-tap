import { createClient } from "@/lib/supabase/server";
import { getDeviceCookieToken, hashDeviceToken } from "@/lib/device/device-cookie";
import { jsonOk, jsonError } from "@/lib/api-response";

export async function GET() {
  try {
    const supabase = await createClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return jsonError("UNAUTHENTICATED", "Bạn chưa đăng nhập", 401);
    }

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
