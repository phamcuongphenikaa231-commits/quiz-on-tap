import { requireAdmin } from "@/lib/auth/require-admin";
import { jsonOk, jsonError } from "@/lib/api-response";
import { z } from "zod";

const uuidSchema = z.string().uuid("ID bài hát không hợp lệ");

const updateTrackSchema = z.object({
  title: z.string().trim().min(1, "Tên bài hát không được để trống").max(150, "Tên bài hát quá dài").optional(),
  artist: z.string().trim().max(150, "Tên tác giả quá dài").optional(),
  category: z.string().trim().optional(),
  audioUrl: z
    .string()
    .trim()
    .refine((url) => /^https:\/\//i.test(url), {
      message: "Link âm thanh phải bắt đầu bằng https://",
    })
    .optional(),
  durationLabel: z.string().trim().optional(),
  sortOrder: z.number().int().min(0, "Thứ tự sắp xếp phải từ 0 trở lên").optional(),
  isActive: z.boolean().optional(),
});

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ trackId: string }> }
) {
  try {
    const { trackId } = await params;
    const { supabase } = await requireAdmin();

    const idCheck = uuidSchema.safeParse(trackId);
    if (!idCheck.success) {
      return jsonError("INVALID_ID", "ID bài hát không hợp lệ", 400);
    }

    const body = await req.json();
    const result = updateTrackSchema.safeParse(body);
    if (!result.success) {
      const firstErr = result.error.issues[0]?.message || "Dữ liệu không hợp lệ";
      return jsonError("INVALID_DATA", firstErr, 400);
    }

    const val = result.data;
    const updateData: Record<string, unknown> = {};
    if (val.title !== undefined) updateData.title = val.title;
    if (val.artist !== undefined) updateData.artist = val.artist;
    if (val.category !== undefined) updateData.category = val.category;
    if (val.audioUrl !== undefined) updateData.audio_url = val.audioUrl;
    if (val.durationLabel !== undefined) updateData.duration_label = val.durationLabel;
    if (val.sortOrder !== undefined) updateData.sort_order = val.sortOrder;
    if (val.isActive !== undefined) updateData.is_active = val.isActive;

    if (Object.keys(updateData).length === 0) {
      return jsonError("NO_DATA", "Không có dữ liệu thay đổi", 400);
    }

    const { data: updated, error } = await supabase
      .from("music_tracks")
      .update(updateData)
      .eq("id", trackId)
      .select("id, title, artist, category, audio_url, duration_label, sort_order, is_active")
      .single();

    if (error) {
      console.error("Update music track error:", error.message);
      return jsonError("UPDATE_ERROR", error.message || "Không thể cập nhật bài hát", 500);
    }

    return jsonOk({
      track: {
        id: updated.id,
        title: updated.title,
        artist: updated.artist,
        category: updated.category,
        src: updated.audio_url,
        durationLabel: updated.duration_label,
        sortOrder: updated.sort_order,
        isActive: updated.is_active,
      },
    });
  } catch {
    return jsonError("UNAUTHORIZED", "Bạn không có quyền thực hiện thao tác này", 403);
  }
}

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ trackId: string }> }
) {
  try {
    const { trackId } = await params;
    const { supabase } = await requireAdmin();

    const idCheck = uuidSchema.safeParse(trackId);
    if (!idCheck.success) {
      return jsonError("INVALID_ID", "ID bài hát không hợp lệ", 400);
    }

    const { error } = await supabase
      .from("music_tracks")
      .delete()
      .eq("id", trackId);

    if (error) {
      console.error("Delete music track error:", error.message);
      return jsonError("DELETE_ERROR", error.message || "Không thể xóa bài hát", 500);
    }

    return jsonOk({ deletedId: trackId });
  } catch {
    return jsonError("UNAUTHORIZED", "Bạn không có quyền thực hiện thao tác này", 403);
  }
}
