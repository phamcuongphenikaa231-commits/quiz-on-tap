import { requireAdminForApi } from "@/lib/auth/require-admin";
import { createAdminClient } from "@/lib/supabase/admin";
import { jsonOk, jsonError } from "@/lib/api-response";

export async function GET() {
  const auth = await requireAdminForApi();
  if (!auth) return jsonError("FORBIDDEN", "Không có quyền quản trị", 403);

  const admin = createAdminClient();

  // Lấy profiles
  const { data: profiles, error: pError } = await admin
    .from("profiles")
    .select("id, email, full_name, role, status, created_at, updated_at")
    .order("created_at", { ascending: false });

  if (pError) {
    return jsonError("DB_ERROR", "Lỗi lấy danh sách người dùng", 500);
  }

  // Lấy tất cả user_subjects
  const { data: userSubjects } = await admin
    .from("user_subjects")
    .select("user_id, subject_id, is_active, subjects(title)")
    .eq("is_active", true);

  // Lấy tất cả devices (count active & last_seen)
  const { data: devices } = await admin
    .from("user_devices")
    .select("user_id, last_seen_at, revoked_at")
    .is("revoked_at", null);

  // Map dữ liệu
  const usersWithDetails = (profiles || []).map((user) => {
    const userSubs = (userSubjects || [])
      .filter((us) => us.user_id === user.id)
      .map((us) => ({
        subject_id: us.subject_id,
        title: (us.subjects as unknown as { title: string })?.title || "",
      }));

    const userDevs = (devices || []).filter((d) => d.user_id === user.id);
    const lastSeen = userDevs.reduce((latest: string | null, d) => {
      if (!latest || new Date(d.last_seen_at) > new Date(latest)) {
        return d.last_seen_at;
      }
      return latest;
    }, null);

    return {
      ...user,
      subjects: userSubs,
      device_count: userDevs.length,
      last_seen_at: lastSeen,
    };
  });

  return jsonOk(usersWithDetails);
}

export async function POST(request: Request) {
  const auth = await requireAdminForApi();
  if (!auth) return jsonError("FORBIDDEN", "Không có quyền quản trị", 403);

  try {
    const body = await request.json();
    const { email, password, full_name } = body;

    if (!email || !password || !full_name) {
      return jsonError("MISSING_FIELDS", "Vui lòng nhập đầy đủ thông tin", 400);
    }

    if (password.length < 6) {
      return jsonError("INVALID_PASSWORD", "Mật khẩu phải từ 6 ký tự trở lên", 400);
    }

    const admin = createAdminClient();

    // Tạo user với email_confirm: true
    const { data: newUser, error: createError } = await admin.auth.admin.createUser({
      email: email.trim(),
      password: password,
      email_confirm: true,
      user_metadata: {
        full_name: full_name.trim(),
      },
    });

    if (createError) {
      if (createError.message.includes("already")) {
        return jsonError("EMAIL_EXISTS", "Email này đã được sử dụng", 400);
      }
      return jsonError("CREATE_FAILED", createError.message, 400);
    }

    return jsonOk({
      id: newUser.user.id,
      email: newUser.user.email,
      full_name: full_name.trim(),
    });
  } catch {
    return jsonError("INTERNAL_ERROR", "Lỗi hệ thống", 500);
  }
}
