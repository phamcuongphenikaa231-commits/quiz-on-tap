import "server-only";

import { createClient } from "@supabase/supabase-js";

/**
 * Supabase admin client dùng service_role key.
 * CHỈ dùng trong Route Handler server.
 * Luôn kiểm tra quyền user trước khi sử dụng.
 */
export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SECRET_KEY;

  if (!url || !key) {
    throw new Error(
      "Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SECRET_KEY env vars"
    );
  }

  return createClient(url, key, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}
