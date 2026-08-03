import { requireUser } from "@/lib/auth/require-user";
import { jsonOk, jsonError } from "@/lib/api-response";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const { supabase } = await requireUser();

    // Query active tracks only, select specific columns, order by sort_order asc, created_at asc
    const { data: rows, error } = await supabase
      .from("music_tracks")
      .select("id, title, artist, category, audio_url, duration_label, sort_order")
      .eq("is_active", true)
      .order("sort_order", { ascending: true })
      .order("created_at", { ascending: true });

    if (error) {
      console.error("Fetch student music tracks error:", error.message);
      return jsonError("FETCH_ERROR", "Không thể tải danh sách nhạc", 500);
    }

    const tracks = (rows || []).map((r) => ({
      id: r.id,
      title: r.title,
      artist: r.artist,
      category: r.category,
      src: r.audio_url,
      durationLabel: r.duration_label,
      sortOrder: r.sort_order,
    }));

    return jsonOk({ tracks });
  } catch {
    return jsonError("UNAUTHENTICATED", "Bạn cần đăng nhập để xem danh sách nhạc", 401);
  }
}
