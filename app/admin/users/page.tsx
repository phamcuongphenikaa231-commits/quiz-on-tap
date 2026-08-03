"use client";

import { useState, useEffect, useCallback } from "react";
import {
  UserPlus,
  RotateCcw,
  Lock,
  Unlock,
  BookOpen,
  Loader2,
  Check,
  X,
} from "lucide-react";

interface GrantedSubject {
  subject_id: string;
  title: string;
}

interface UserItem {
  id: string;
  email: string;
  full_name: string;
  role: string;
  status: "active" | "blocked";
  created_at: string;
  subjects: GrantedSubject[];
  device_count: number;
  last_seen_at: string | null;
}

interface SubjectItem {
  id: string;
  title: string;
  slug: string;
  is_granted: boolean;
}

export default function AdminUsersPage() {
  const [users, setUsers] = useState<UserItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [successMsg, setSuccessMsg] = useState("");

  // Create User Modal State
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newEmail, setNewEmail] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [newFullName, setNewFullName] = useState("");
  const [creating, setCreating] = useState(false);

  // Manage Subjects Modal State
  const [selectedUser, setSelectedUser] = useState<UserItem | null>(null);
  const [userSubjectsList, setUserSubjectsList] = useState<SubjectItem[]>([]);
  const [loadingSubjects, setLoadingSubjects] = useState(false);

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/admin/users");
      const data = await res.json();

      if (!res.ok || !data.ok) {
        setError(data.message || "Không thể tải danh sách người dùng");
        return;
      }
      setUsers(data.data);
    } catch {
      setError("Mất kết nối. Vui lòng thử lại.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  // Handle Create User
  async function handleCreateUser(e: React.FormEvent) {
    e.preventDefault();
    if (creating) return;
    setCreating(true);
    setError("");

    try {
      const res = await fetch("/api/admin/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: newEmail,
          password: newPassword,
          full_name: newFullName,
        }),
      });
      const data = await res.json();

      if (!res.ok || !data.ok) {
        setError(data.message || "Không thể tạo tài khoản");
        setCreating(false);
        return;
      }

      setSuccessMsg(`Tạo tài khoản thành công: ${data.data.email}`);
      setShowCreateModal(false);
      setNewEmail("");
      setNewPassword("");
      setNewFullName("");
      fetchUsers();
    } catch {
      setError("Lỗi kết nối khi tạo tài khoản");
    } finally {
      setCreating(false);
    }
  }

  // Handle Toggle Status (Lock/Unlock)
  async function handleToggleStatus(user: UserItem) {
    const newStatus = user.status === "active" ? "blocked" : "active";
    let confirmSelfBlock = false;

    if (newStatus === "blocked") {
      const confirmText = user.role === "admin"
        ? "Chú ý: Bạn đang thực hiện khóa tài khoản ADMIN! Bạn có chắc chắn không?"
        : `Bạn có chắc chắn muốn khóa tài khoản "${user.full_name || user.email}"?`;
      if (!confirm(confirmText)) return;
      confirmSelfBlock = true;
    }

    try {
      const res = await fetch(`/api/admin/users/${user.id}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus, confirmSelfBlock }),
      });
      const data = await res.json();

      if (!res.ok || !data.ok) {
        alert(data.message || "Thao tác thất bại");
        return;
      }

      setSuccessMsg(
        `Đã ${newStatus === "active" ? "mở khóa" : "khóa"} tài khoản ${user.email}`
      );
      fetchUsers();
    } catch {
      alert("Lỗi kết nối server");
    }
  }

  // Handle Reset Devices
  async function handleResetDevices(user: UserItem) {
    if (!confirm(`Reset toàn bộ thiết bị của tài khoản "${user.email}"?`)) {
      return;
    }

    try {
      const res = await fetch(`/api/admin/users/${user.id}/devices/reset`, {
        method: "POST",
      });
      const data = await res.json();

      if (!res.ok || !data.ok) {
        alert(data.message || "Reset thiết bị thất bại");
        return;
      }

      setSuccessMsg(`Đã reset thiết bị cho tài khoản ${user.email}`);
      fetchUsers();
    } catch {
      alert("Lỗi kết nối server");
    }
  }

  // Open Subject Management Modal
  async function openSubjectsModal(user: UserItem) {
    setSelectedUser(user);
    setLoadingSubjects(true);

    try {
      const res = await fetch(`/api/admin/users/${user.id}/subjects`);
      const data = await res.json();

      if (res.ok && data.ok) {
        setUserSubjectsList(data.data);
      } else {
        alert("Không thể lấy danh sách môn học");
      }
    } catch {
      alert("Lỗi kết nối");
    } finally {
      setLoadingSubjects(false);
    }
  }

  // Grant or Revoke Subject
  async function handleToggleSubject(subject: SubjectItem) {
    if (!selectedUser) return;

    try {
      if (subject.is_granted) {
        // Revoke
        const res = await fetch(
          `/api/admin/users/${selectedUser.id}/subjects?subjectId=${subject.id}`,
          { method: "DELETE" }
        );
        const data = await res.json();

        if (res.ok && data.ok) {
          setUserSubjectsList((prev) =>
            prev.map((s) => (s.id === subject.id ? { ...s, is_granted: false } : s))
          );
          fetchUsers();
        } else {
          alert(data.message || "Lỗi thu hồi môn");
        }
      } else {
        // Grant
        const res = await fetch(`/api/admin/users/${selectedUser.id}/subjects`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ subjectId: subject.id }),
        });
        const data = await res.json();

        if (res.ok && data.ok) {
          setUserSubjectsList((prev) =>
            prev.map((s) => (s.id === subject.id ? { ...s, is_granted: true } : s))
          );
          fetchUsers();
        } else {
          alert(data.message || "Lỗi cấp môn");
        }
      }
    } catch {
      alert("Lỗi thao tác môn học");
    }
  }

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-bold text-foreground">
            Quản lý học viên
          </h1>
          <p className="text-sm text-muted-foreground">
            Tạo tài khoản, quản lý thiết bị và cấp quyền môn học
          </p>
        </div>
        <button
          onClick={() => setShowCreateModal(true)}
          className="flex items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground shadow hover:bg-primary/90 transition-colors"
        >
          <UserPlus className="h-4 w-4" />
          Tạo tài khoản mới
        </button>
      </div>

      {/* Messages */}
      {error && (
        <div className="rounded-lg bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      )}
      {successMsg && (
        <div className="rounded-lg bg-emerald-50 px-4 py-3 text-sm text-emerald-600 border border-emerald-200 flex items-center justify-between">
          <span>{successMsg}</span>
          <button onClick={() => setSuccessMsg("")}>
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* Users Table */}
      <div className="rounded-xl border bg-card shadow-sm overflow-hidden">
        {loading ? (
          <div className="flex py-12 justify-center items-center gap-2 text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin" />
            <span>Đang tải danh sách...</span>
          </div>
        ) : users.length === 0 ? (
          <div className="p-8 text-center text-muted-foreground text-sm">
            Chưa có tài khoản nào.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-muted/50 text-xs font-semibold text-muted-foreground uppercase border-b">
                <tr>
                  <th className="px-4 py-3">Họ tên / Email</th>
                  <th className="px-4 py-3">Vai trò</th>
                  <th className="px-4 py-3">Trạng thái</th>
                  <th className="px-4 py-3">Môn được cấp</th>
                  <th className="px-4 py-3 text-center">Thiết bị</th>
                  <th className="px-4 py-3">Lần hoạt động</th>
                  <th className="px-4 py-3 text-right">Thao tác</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {users.map((u) => (
                  <tr key={u.id} className="hover:bg-accent/40 transition-colors">
                    <td className="px-4 py-3">
                      <p className="font-medium text-foreground">
                        {u.full_name || "—"}
                      </p>
                      <p className="text-xs text-muted-foreground">{u.email}</p>
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                          u.role === "admin"
                            ? "bg-purple-100 text-purple-700"
                            : "bg-gray-100 text-gray-700"
                        }`}
                      >
                        {u.role === "admin" ? "Admin" : "Học viên"}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${
                          u.status === "active"
                            ? "bg-emerald-100 text-emerald-700"
                            : "bg-red-100 text-red-700"
                        }`}
                      >
                        {u.status === "active" ? "Hoạt động" : "Bị khóa"}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      {u.subjects.length === 0 ? (
                        <span className="text-xs text-muted-foreground">Chưa có</span>
                      ) : (
                        <div className="flex flex-wrap gap-1">
                          {u.subjects.map((sub) => (
                            <span
                              key={sub.subject_id}
                              className="rounded bg-secondary px-1.5 py-0.5 text-xs font-medium text-secondary-foreground"
                            >
                              {sub.title}
                            </span>
                          ))}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span
                        className={`inline-flex items-center justify-center font-bold px-2 py-0.5 rounded text-xs ${
                          u.device_count >= 2
                            ? "bg-amber-100 text-amber-800"
                            : "bg-blue-50 text-blue-600"
                        }`}
                      >
                        {u.device_count} / 2
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">
                      {u.last_seen_at
                        ? new Date(u.last_seen_at).toLocaleString("vi-VN")
                        : "Chưa có"}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => openSubjectsModal(u)}
                          title="Cấp/Thu hồi môn"
                          className="p-1.5 rounded-lg text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
                        >
                          <BookOpen className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => handleResetDevices(u)}
                          title="Reset thiết bị"
                          className="p-1.5 rounded-lg text-muted-foreground hover:bg-amber-50 hover:text-amber-600 transition-colors"
                        >
                          <RotateCcw className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => handleToggleStatus(u)}
                          title={u.status === "active" ? "Khóa tài khoản" : "Mở khóa"}
                          className={`p-1.5 rounded-lg transition-colors ${
                            u.status === "active"
                              ? "text-muted-foreground hover:bg-red-50 hover:text-red-600"
                              : "text-emerald-600 hover:bg-emerald-50"
                          }`}
                        >
                          {u.status === "active" ? (
                            <Lock className="h-4 w-4" />
                          ) : (
                            <Unlock className="h-4 w-4" />
                          )}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal: Tạo tài khoản mới */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-2xl bg-card p-6 shadow-xl animate-fade-in border">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-foreground">
                Tạo tài khoản học viên
              </h3>
              <button
                onClick={() => setShowCreateModal(false)}
                className="text-muted-foreground hover:text-foreground"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleCreateUser} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">
                  Họ và tên
                </label>
                <input
                  type="text"
                  required
                  value={newFullName}
                  onChange={(e) => setNewFullName(e.target.value)}
                  placeholder="Nguyễn Văn A"
                  className="w-full rounded-lg border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/20"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-foreground mb-1">
                  Email
                </label>
                <input
                  type="email"
                  required
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                  placeholder="hocvien@example.com"
                  className="w-full rounded-lg border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/20"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-foreground mb-1">
                  Mật khẩu tạm
                </label>
                <input
                  type="text"
                  required
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full rounded-lg border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/20"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="rounded-lg border px-4 py-2 text-sm font-medium text-foreground hover:bg-accent"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  disabled={creating}
                  className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
                >
                  {creating ? "Đang tạo..." : "Tạo học viên"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Cấp môn học */}
      {selectedUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-2xl bg-card p-6 shadow-xl animate-fade-in border">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-lg font-bold text-foreground">
                Cấp quyền môn học
              </h3>
              <button
                onClick={() => setSelectedUser(null)}
                className="text-muted-foreground hover:text-foreground"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <p className="text-xs text-muted-foreground mb-4">
              Học viên: <span className="font-semibold text-foreground">{selectedUser.full_name || selectedUser.email}</span>
            </p>

            {loadingSubjects ? (
              <div className="flex py-8 justify-center items-center gap-2 text-muted-foreground">
                <Loader2 className="h-5 w-5 animate-spin" />
                <span>Đang tải môn học...</span>
              </div>
            ) : userSubjectsList.length === 0 ? (
              <div className="py-6 text-center text-sm text-muted-foreground">
                Chưa có môn học nào trong hệ thống. Vui lòng nhập môn học trước.
              </div>
            ) : (
              <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                {userSubjectsList.map((sub) => (
                  <div
                    key={sub.id}
                    className="flex items-center justify-between p-3 rounded-lg border bg-background"
                  >
                    <div>
                      <p className="text-sm font-medium text-foreground">
                        {sub.title}
                      </p>
                      <p className="text-xs text-muted-foreground">slug: {sub.slug}</p>
                    </div>
                    <button
                      onClick={() => handleToggleSubject(sub)}
                      className={`flex items-center gap-1 px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                        sub.is_granted
                          ? "bg-emerald-100 text-emerald-700 hover:bg-red-100 hover:text-red-700"
                          : "bg-secondary text-secondary-foreground hover:bg-emerald-100 hover:text-emerald-700"
                      }`}
                    >
                      {sub.is_granted ? (
                        <>
                          <Check className="h-3.5 w-3.5" />
                          Đã cấp
                        </>
                      ) : (
                        "Cấp quyền"
                      )}
                    </button>
                  </div>
                ))}
              </div>
            )}

            <div className="flex justify-end pt-4">
              <button
                onClick={() => setSelectedUser(null)}
                className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
              >
                Đóng
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
