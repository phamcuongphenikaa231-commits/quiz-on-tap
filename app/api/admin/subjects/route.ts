import { requireAdminForApi } from "@/lib/auth/require-admin";
import { createAdminClient } from "@/lib/supabase/admin";
import { jsonOk, jsonError } from "@/lib/api-response";
import { createSubjectSchema } from "@/lib/content/schemas";

export const dynamic = "force-dynamic";

export async function GET() {
  const auth = await requireAdminForApi();
  if (!auth) return jsonError("FORBIDDEN", "Không có quyền quản trị", 403);

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("subjects")
    .select("id, title, slug, description, sort_order, is_published, created_at")
    .order("sort_order", { ascending: true });

  if (error) return jsonError("FETCH_FAILED", `Lỗi lấy danh sách môn: ${error.message}`, 500);
  return jsonOk(data || []);
}

export async function POST(request: Request) {
  const auth = await requireAdminForApi();
  if (!auth) return jsonError("FORBIDDEN", "Không có quyền quản trị", 403);

  try {
    const body = await request.json();
    const parsed = createSubjectSchema.safeParse(body);
    if (!parsed.success) {
      const msg = parsed.error.issues.map((i) => i.message).join("; ");
      return jsonError("VALIDATION_ERROR", msg, 400);
    }

    const { title, slug, description, sortOrder, isPublished } = parsed.data;
    const admin = createAdminClient();

    // Check duplicate slug
    const { data: existing } = await admin
      .from("subjects")
      .select("id")
      .eq("slug", slug)
      .maybeSingle();

    if (existing) {
      return jsonError("SLUG_DUPLICATE", `Slug "${slug}" đã tồn tại trong hệ thống. Vui lòng chọn slug khác.`, 409);
    }

    const { data, error } = await admin
      .from("subjects")
      .insert({
        title,
        slug,
        description: description || "",
        sort_order: sortOrder ?? 0,
        is_published: isPublished ?? false,
      })
      .select("id, title, slug")
      .single();

    if (error) return jsonError("INSERT_FAILED", `Lỗi tạo môn học: ${error.message}`, 500);
    return jsonOk(data, 201);
  } catch {
    return jsonError("INTERNAL_ERROR", "Lỗi hệ thống", 500);
  }
}
