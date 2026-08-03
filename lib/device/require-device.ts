import "server-only";

import { getDeviceCookieToken, hashDeviceToken } from "./device-cookie";
import { createClient } from "@/lib/supabase/server";

/**
 * Kiểm tra thiết bị hiện tại có đang active trong DB không.
 * Trả false nếu không có cookie hoặc thiết bị đã bị revoke/admin reset.
 */
export async function isDeviceActive(): Promise<boolean> {
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
