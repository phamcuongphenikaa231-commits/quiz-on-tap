import { requireAdminForApi } from "@/lib/auth/require-admin";
import { createAdminClient } from "@/lib/supabase/admin";
import { jsonOk, jsonError } from "@/lib/api-response";
import { updateSubjectSchema } from "@/lib/content/schemas";

export const dynamic = "force-dynamic";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ subjectId: string }> }
) {
  const auth = await requireAdminForApi();
  if (!auth) return jsonError("FORBIDDEN", "Không có quyền quản trị", 403);

  const { subjectId } = await params;

  try {
    const body = await request.json();
    const parsed = updateSubjectSchema.safeParse(body);
    if (!parsed.success) {
      const msg = parsed.error.issues.map((i) => i.message).join("; ");
      return jsonError("VALIDATION_ERROR", msg, 400);
    }

    const updates: Record<string, unknown> = {};
    const d = parsed.data;
    if (d.title !== undefined) updates.title = d.title;
    if (d.slug !== undefined) updates.slug = d.slug;
    if (d.description !== undefined) updates.description = d.description;
    if (d.sortOrder !== undefined) updates.sort_order = d.sortOrder;
    if (d.isPublished !== undefined) updates.is_published = d.isPublished;

    if (Object.keys(updates).length === 0) {
      return jsonError("NO_CHANGES", "Không có thay đổi nào", 400);
    }

    // Check slug duplicate if slug changed
    if (d.slug) {
      const admin = createAdminClient();
      const { data: existing } = await admin
        .from("subjects")
        .select("id")
        .eq("slug", d.slug)
        .neq("id", subjectId)
        .maybeSingle();

      if (existing) {
        return jsonError("SLUG_DUPLICATE", `Slug "${d.slug}" đã tồn tại. Vui lòng chọn slug khác.`, 409);
      }
    }

    const admin = createAdminClient();
    const { data, error } = await admin
      .from("subjects")
      .update(updates)
      .eq("id", subjectId)
      .select("id, title, slug")
      .single();

    if (error) return jsonError("UPDATE_FAILED", `Lỗi cập nhật: ${error.message}`, 500);
    return jsonOk(data);
  } catch {
    return jsonError("INTERNAL_ERROR", "Lỗi hệ thống", 500);
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ subjectId: string }> }
) {
  const auth = await requireAdminForApi();
  if (!auth) return jsonError("FORBIDDEN", "Không có quyền quản trị", 403);

  const { subjectId } = await params;
  const admin = createAdminClient();

  const { error } = await admin
    .from("subjects")
    .delete()
    .eq("id", subjectId);

  if (error) return jsonError("DELETE_FAILED", `Lỗi xóa môn học: ${error.message}`, 500);
  return jsonOk({ message: "Đã xóa môn học thành công" });
}
