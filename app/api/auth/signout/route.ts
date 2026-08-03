import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function POST() {
  const supabase = await createClient();
  await supabase.auth.signOut();

  // Giữ cookie thiết bị khi đăng xuất
  return NextResponse.redirect(new URL("/login", process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "http://localhost:3000"), {
    status: 302,
  });
}
