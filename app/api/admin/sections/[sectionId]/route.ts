import { requireAdminForApi } from "@/lib/auth/require-admin";
import { createAdminClient } from "@/lib/supabase/admin";
import { jsonOk, jsonError } from "@/lib/api-response";
import { updateSectionSchema } from "@/lib/content/schemas";

export const dynamic = "force-dynamic";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ sectionId: string }> }
) {
  const auth = await requireAdminForApi();
  if (!auth) return jsonError("FORBIDDEN", "Không có quyền quản trị", 403);

  const { sectionId } = await params;

  try {
    const body = await request.json();
    const parsed = updateSectionSchema.safeParse(body);
    if (!parsed.success) {
      const msg = parsed.error.issues.map((i) => i.message).join("; ");
      return jsonError("VALIDATION_ERROR", msg, 400);
    }

    const admin = createAdminClient();
    const d = parsed.data;

    // Get current section to know subject_id
    const { data: current } = await admin
      .from("sections")
      .select("id, subject_id")
      .eq("id", sectionId)
      .single();

    if (!current) return jsonError("NOT_FOUND", "Không tìm thấy phần này", 404);

    // Check self-reference for parentId
    if (d.parentId === sectionId) {
      return jsonError("SELF_REFERENCE", "Không thể chọn chính phần này làm phần cha", 400);
    }

    // Check slug duplicate
    if (d.slug) {
      const { data: existing } = await admin
        .from("sections")
        .select("id")
        .eq("subject_id", current.subject_id)
        .eq("slug", d.slug)
        .neq("id", sectionId)
        .maybeSingle();

      if (existing) {
        return jsonError("SLUG_DUPLICATE", `Slug "${d.slug}" đã tồn tại trong môn này.`, 409);
      }
    }

    const updates: Record<string, unknown> = {};
    if (d.title !== undefined) updates.title = d.title;
    if (d.slug !== undefined) updates.slug = d.slug;
    if (d.parentId !== undefined) updates.parent_id = d.parentId || null;
    if (d.sortOrder !== undefined) updates.sort_order = d.sortOrder;
    if (d.isPublished !== undefined) updates.is_published = d.isPublished;

    if (Object.keys(updates).length === 0) {
      return jsonError("NO_CHANGES", "Không có thay đổi nào", 400);
    }

    const { data, error } = await admin
      .from("sections")
      .update(updates)
      .eq("id", sectionId)
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
  { params }: { params: Promise<{ sectionId: string }> }
) {
  const auth = await requireAdminForApi();
  if (!auth) return jsonError("FORBIDDEN", "Không có quyền quản trị", 403);

  const { sectionId } = await params;
  const admin = createAdminClient();

  const { error } = await admin
    .from("sections")
    .delete()
    .eq("id", sectionId);

  if (error) return jsonError("DELETE_FAILED", `Lỗi xóa phần: ${error.message}`, 500);
  return jsonOk({ message: "Đã xóa phần thành công" });
}
