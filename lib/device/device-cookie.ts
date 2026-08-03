import "server-only";

import { cookies } from "next/headers";
import { createHash, randomBytes } from "crypto";

const COOKIE_NAME = process.env.DEVICE_COOKIE_NAME || "quiz_device";
const MAX_AGE = 365 * 24 * 60 * 60; // 1 year

/**
 * Đọc device token gốc từ cookie.
 */
export async function getDeviceCookieToken(): Promise<string | undefined> {
  const cookieStore = await cookies();
  return cookieStore.get(COOKIE_NAME)?.value;
}

/**
 * Tạo token ngẫu nhiên cho thiết bị mới.
 */
export function generateDeviceToken(): string {
  return randomBytes(32).toString("hex");
}

/**
 * Hash SHA-256 token gốc thành chuỗi hex 64 ký tự để lưu vào DB.
 */
export function hashDeviceToken(rawToken: string): string {
  return createHash("sha256").update(rawToken).digest("hex");
}

/**
 * Đặt cookie thiết bị.
 */
export async function setDeviceCookie(rawToken: string): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.set(COOKIE_NAME, rawToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: MAX_AGE,
  });
}
