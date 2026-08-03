import "server-only";

import { requireUser, requireUserForApi, type AuthContext } from "./require-user";
import { redirect } from "next/navigation";

/**
 * Kiểm tra user hiện tại là admin active.
 * Dùng trong Server Component admin pages.
 */
export async function requireAdmin(): Promise<AuthContext> {
  const ctx = await requireUser();

  if (ctx.profile.role !== "admin" || ctx.profile.status !== "active") {
    redirect("/dashboard");
  }

  return ctx;
}

/**
 * Phiên bản cho Route Handler - trả null nếu không phải admin.
 */
export async function requireAdminForApi(): Promise<AuthContext | null> {
  const ctx = await requireUserForApi();

  if (!ctx) return null;
  if (ctx.profile.role !== "admin" || ctx.profile.status !== "active") {
    return null;
  }

  return ctx;
}
