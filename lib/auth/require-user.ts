import "server-only";

import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import type { SupabaseClient, User } from "@supabase/supabase-js";

export interface AuthContext {
  user: User;
  supabase: SupabaseClient;
  profile: { role: string; status: string };
}

/**
 * Xác thực user hiện tại từ Supabase SSR.
 * Redirect về /login nếu chưa đăng nhập.
 * Trả về user, supabase client, và profile.
 */
export async function requireUser(): Promise<AuthContext> {
  const supabase = await createClient();

  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) {
    redirect("/login");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role, status")
    .eq("id", user.id)
    .single();

  if (!profile) {
    redirect("/login");
  }

  if (profile.status === "blocked") {
    await supabase.auth.signOut();
    redirect("/login?error=blocked");
  }

  return { user, supabase, profile };
}

/**
 * Phiên bản cho Route Handler - trả null thay vì redirect.
 */
export async function requireUserForApi(): Promise<AuthContext | null> {
  const supabase = await createClient();

  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) {
    return null;
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role, status")
    .eq("id", user.id)
    .single();

  if (!profile) {
    return null;
  }

  return { user, supabase, profile };
}
