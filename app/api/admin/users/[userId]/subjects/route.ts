import { requireAdminForApi } from "@/lib/auth/require-admin";
import { createAdminClient } from "@/lib/supabase/admin";
import { jsonOk, jsonError } from "@/lib/api-response";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ userId: string }> }
) {
  const auth = await requireAdminForApi();
  if (!auth) return jsonError("FORBIDDEN", "Không có quyền quản trị", 403);

  const { userId } = await params;
  const admin = createAdminClient();

  // Lấy tất cả môn học
  const { data: allSubjects } = await admin
    .from("subjects")
    .select("id, title, slug, is_published")
    .order("sort_order");

  // Lấy môn học được cấp cho user
  const { data: userSubjects } = await admin
    .from("user_subjects")
    .select("subject_id, is_active")
    .eq("user_id", userId);

  const grantedIds = new Set(
    (userSubjects || []).filter((us) => us.is_active).map((us) => us.subject_id)
  );

  const subjects = (allSubjects || []).map((sub) => ({
    ...sub,
    is_granted: grantedIds.has(sub.id),
  }));

  return jsonOk(subjects);
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ userId: string }> }
) {
  const auth = await requireAdminForApi();
  if (!auth) return jsonError("FORBIDDEN", "Không có quyền quản trị", 403);

  try {
    const { userId } = await params;
    const body = await request.json();
    const { subjectId } = body;

    if (!subjectId) {
      return jsonError("MISSING_SUBJECT", "Vui lòng chọn môn học", 400);
    }

    const admin = createAdminClient();

    const { error } = await admin.from("user_subjects").upsert({
      user_id: userId,
      subject_id: subjectId,
      is_active: true,
      granted_by: auth.user.id,
    });

    if (error) {
      return jsonError("GRANT_FAILED", "Không thể cấp quyền môn học", 500);
    }

    return jsonOk({ success: true });
  } catch {
    return jsonError("INTERNAL_ERROR", "Lỗi hệ thống", 500);
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ userId: string }> }
) {
  const auth = await requireAdminForApi();
  if (!auth) return jsonError("FORBIDDEN", "Không có quyền quản trị", 403);

  try {
    const { userId } = await params;
    const url = new URL(request.url);
    const subjectId = url.searchParams.get("subjectId");

    if (!subjectId) {
      return jsonError("MISSING_SUBJECT", "Vui lòng chọn môn học", 400);
    }

    const admin = createAdminClient();

    const { error } = await admin
      .from("user_subjects")
      .update({ is_active: false })
      .eq("user_id", userId)
      .eq("subject_id", subjectId);

    if (error) {
      return jsonError("REVOKE_FAILED", "Không thể thu hồi quyền môn học", 500);
    }

    return jsonOk({ success: true });
  } catch {
    return jsonError("INTERNAL_ERROR", "Lỗi hệ thống", 500);
  }
}
