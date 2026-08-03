import { requireAdminForApi } from "@/lib/auth/require-admin";
import { createAdminClient } from "@/lib/supabase/admin";
import { jsonOk, jsonError } from "@/lib/api-response";
import { createSectionSchema } from "@/lib/content/schemas";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const auth = await requireAdminForApi();
  if (!auth) return jsonError("FORBIDDEN", "Không có quyền quản trị", 403);

  const { searchParams } = new URL(request.url);
  const subjectId = searchParams.get("subjectId");

  const admin = createAdminClient();

  let query = admin
    .from("sections")
    .select("id, subject_id, parent_id, title, slug, sort_order, is_published, created_at")
    .order("sort_order", { ascending: true });

  if (subjectId) {
    query = query.eq("subject_id", subjectId);
  }

  const { data, error } = await query;
  if (error) return jsonError("FETCH_FAILED", `Lỗi lấy danh sách phần: ${error.message}`, 500);
  return jsonOk(data || []);
}

export async function POST(request: Request) {
  const auth = await requireAdminForApi();
  if (!auth) return jsonError("FORBIDDEN", "Không có quyền quản trị", 403);

  try {
    const body = await request.json();
    const parsed = createSectionSchema.safeParse(body);
    if (!parsed.success) {
      const msg = parsed.error.issues.map((i) => i.message).join("; ");
      return jsonError("VALIDATION_ERROR", msg, 400);
    }

    const { subjectId, parentId, title, slug, sortOrder, isPublished } = parsed.data;
    const admin = createAdminClient();

    // Check slug duplicate within same subject
    const { data: existing } = await admin
      .from("sections")
      .select("id")
      .eq("subject_id", subjectId)
      .eq("slug", slug)
      .maybeSingle();

    if (existing) {
      return jsonError("SLUG_DUPLICATE", `Slug "${slug}" đã tồn tại trong môn này. Vui lòng chọn slug khác.`, 409);
    }

    // Validate parent belongs to same subject if parentId given
    if (parentId) {
      const { data: parent } = await admin
        .from("sections")
        .select("id, subject_id")
        .eq("id", parentId)
        .single();

      if (!parent) {
        return jsonError("PARENT_NOT_FOUND", "Phần cha không tồn tại", 404);
      }
      if (parent.subject_id !== subjectId) {
        return jsonError("PARENT_WRONG_SUBJECT", "Phần cha không thuộc cùng môn học", 400);
      }
    }

    const { data, error } = await admin
      .from("sections")
      .insert({
        subject_id: subjectId,
        parent_id: parentId || null,
        title,
        slug,
        sort_order: sortOrder ?? 0,
        is_published: isPublished ?? true,
      })
      .select("id, title, slug")
      .single();

    if (error) return jsonError("INSERT_FAILED", `Lỗi tạo phần: ${error.message}`, 500);
    return jsonOk(data, 201);
  } catch {
    return jsonError("INTERNAL_ERROR", "Lỗi hệ thống", 500);
  }
}
