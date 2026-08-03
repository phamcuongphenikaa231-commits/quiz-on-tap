import { requireAdmin } from "@/lib/auth/require-admin";
import { jsonOk, jsonError } from "@/lib/api-response";
import { z } from "zod";

const createTrackSchema = z.object({
  title: z.string().trim().min(1, "Tên bài hát không được để trống").max(150, "Tên bài hát quá dài"),
  artist: z.string().trim().max(150, "Tên tác giả quá dài").default(""),
  category: z.string().trim().default("Khác"),
  audioUrl: z
    .string()
    .trim()
    .refine((url) => /^https:\/\//i.test(url), {
      message: "Link âm thanh phải bắt đầu bằng https://",
    }),
  durationLabel: z.string().trim().default(""),
  sortOrder: z.number().int().min(0, "Thứ tự sắp xếp phải từ 0 trở lên").default(0),
  isActive: z.boolean().default(true),
});

export async function GET() {
  try {
    const { supabase } = await requireAdmin();

    const { data: rows, error } = await supabase
      .from("music_tracks")
      .select("id, title, artist, category, audio_url, duration_label, sort_order, is_active, created_at, updated_at")
      .order("sort_order", { ascending: true })
      .order("created_at", { ascending: true });

    if (error) {
      console.error("Fetch admin music tracks error:", error.message);
      return jsonError("FETCH_ERROR", "Không thể lấy danh sách nhạc", 500);
    }

    const tracks = (rows || []).map((r) => ({
      id: r.id,
      title: r.title,
      artist: r.artist,
      category: r.category,
      src: r.audio_url,
      durationLabel: r.duration_label,
      sortOrder: r.sort_order,
      isActive: r.is_active,
    }));

    return jsonOk({ tracks });
  } catch {
    return jsonError("UNAUTHORIZED", "Bạn không có quyền truy cập", 403);
  }
}

export async function POST(req: Request) {
  try {
    const { supabase } = await requireAdmin();
    const body = await req.json();

    const result = createTrackSchema.safeParse(body);
    if (!result.success) {
      const firstErr = result.error.issues[0]?.message || "Dữ liệu không hợp lệ";
      return jsonError("INVALID_DATA", firstErr, 400);
    }

    const val = result.data;

    const { data: inserted, error } = await supabase
      .from("music_tracks")
      .insert({
        title: val.title,
        artist: val.artist,
        category: val.category,
        audio_url: val.audioUrl,
        duration_label: val.durationLabel,
        sort_order: val.sortOrder,
        is_active: val.isActive,
      })
      .select("id, title, artist, category, audio_url, duration_label, sort_order, is_active")
      .single();

    if (error) {
      console.error("Insert music track error:", error.message);
      return jsonError("INSERT_ERROR", error.message || "Không thể tạo bài hát mới", 500);
    }

    return jsonOk({
      track: {
        id: inserted.id,
        title: inserted.title,
        artist: inserted.artist,
        category: inserted.category,
        src: inserted.audio_url,
        durationLabel: inserted.duration_label,
        sortOrder: inserted.sort_order,
        isActive: inserted.is_active,
      },
    });
  } catch {
    return jsonError("UNAUTHORIZED", "Bạn không có quyền thực hiện thao tác này", 403);
  }
}
