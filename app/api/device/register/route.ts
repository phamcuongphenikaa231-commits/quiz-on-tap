import { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  getDeviceCookieToken,
  generateDeviceToken,
  hashDeviceToken,
  setDeviceCookie,
} from "@/lib/device/device-cookie";
import { jsonOk, jsonError } from "@/lib/api-response";
import { isDeviceLimitBypassed } from "@/lib/device/device-limit-config";

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return jsonError("UNAUTHENTICATED", "Bạn chưa đăng nhập", 401);
    }

    // ── Bypass giới hạn thiết bị trong môi trường development ──────────────
    // Chỉ bật khi NODE_ENV !== "production" VÀ DISABLE_DEVICE_LIMIT === "true"
    // Auth vẫn bắt buộc (kiểm tra ở trên rồi mới tới đây).
    if (isDeviceLimitBypassed()) {
      console.info("[Device Limit] Bypassed in local development (register)");
      return jsonOk({ code: "DEVICE_BYPASSED" });
    }
    // ────────────────────────────────────────────────────────────────────────

    const userAgent = request.headers.get("user-agent") || "";
    let rawToken = await getDeviceCookieToken();
    let isNew = false;

    if (!rawToken) {
      rawToken = generateDeviceToken();
      isNew = true;
    }

    const hash = hashDeviceToken(rawToken);

    const { data: rpcResult, error: rpcError } = await supabase.rpc(
      "register_or_touch_device",
      {
        p_device_token_hash: hash,
        p_device_label: "",
        p_user_agent: userAgent.substring(0, 500),
      }
    );

    if (rpcError) {
      return jsonError("RPC_ERROR", "Lỗi hệ thống", 500);
    }

    const result = rpcResult as {
      ok: boolean;
      code: string;
      message?: string;
      device_count?: number;
    };

    if (!result.ok) {
      // If device was revoked (admin reset), try registering with a new token
      if (result.code === "DEVICE_REVOKED") {
        const newToken = generateDeviceToken();
        const newHash = hashDeviceToken(newToken);

        const { data: retryResult, error: retryError } = await supabase.rpc(
          "register_or_touch_device",
          {
            p_device_token_hash: newHash,
            p_device_label: "",
            p_user_agent: userAgent.substring(0, 500),
          }
        );

        if (retryError) {
          return jsonError("RPC_ERROR", "Lỗi hệ thống", 500);
        }

        const retry = retryResult as {
          ok: boolean;
          code: string;
          message?: string;
        };

        if (retry.ok) {
          await setDeviceCookie(newToken);
          return jsonOk({ code: retry.code });
        }

        return jsonError(retry.code, retry.message || "Lỗi thiết bị", 403);
      }

      if (result.code === "DEVICE_LIMIT") {
        return jsonError(
          "DEVICE_LIMIT",
          "Tài khoản đã đạt giới hạn 2 thiết bị",
          403
        );
      }

      if (result.code === "ACCOUNT_BLOCKED") {
        return jsonError("ACCOUNT_BLOCKED", "Tài khoản đang bị khóa", 403);
      }

      return jsonError(
        result.code,
        result.message || "Lỗi thiết bị",
        403
      );
    }

    // Success: set cookie if new
    if (isNew) {
      await setDeviceCookie(rawToken);
    }

    return jsonOk({ code: result.code });
  } catch {
    return jsonError("INTERNAL_ERROR", "Lỗi hệ thống", 500);
  }
}
