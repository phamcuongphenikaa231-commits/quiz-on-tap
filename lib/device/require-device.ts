import "server-only";

import { getDeviceCookieToken, hashDeviceToken } from "./device-cookie";
import { createClient } from "@/lib/supabase/server";
import { isDeviceLimitBypassed } from "./device-limit-config";

/**
 * Kiểm tra thiết bị hiện tại có đang active trong DB không.
 * Trả false nếu không có cookie hoặc thiết bị đã bị revoke/admin reset.
 *
 * Khi DISABLE_DEVICE_LIMIT=true (chỉ ở môi trường development), bỏ qua RPC
 * và luôn trả true — không insert hoặc đọc bảng user_devices.
 */
export async function isDeviceActive(): Promise<boolean> {
  // Bypass: trả true ngay, không gọi DB. Auth được kiểm tra bởi caller.
  if (isDeviceLimitBypassed()) {
    console.info("[Device Limit] Bypassed in local development (isDeviceActive)");
    return true;
  }

  const rawToken = await getDeviceCookieToken();
  if (!rawToken) return false;

  const hash = hashDeviceToken(rawToken);
  const supabase = await createClient();

  const { data, error } = await supabase.rpc("is_current_device_active", {
    p_device_token_hash: hash,
  });

  if (error) return false;
  return data === true;
}

/**
 * Yêu cầu thiết bị active, redirect nếu không hợp lệ.
 * Dùng trong Server Component.
 *
 * Lưu ý: đăng nhập vẫn bắt buộc — bypass chỉ bỏ qua kiểm tra thiết bị.
 */
export async function requireDevice(): Promise<void> {
  const active = await isDeviceActive();
  if (!active) {
    const { redirect } = await import("next/navigation");
    redirect("/device-limit");
  }
}

/**
 * Kiểm tra thiết bị cho API routes. Trả boolean.
 */
export async function requireDeviceForApi(): Promise<boolean> {
  return isDeviceActive();
}
