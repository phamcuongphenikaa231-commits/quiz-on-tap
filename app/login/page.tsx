"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import { Eye, EyeOff, GraduationCap, Loader2 } from "lucide-react";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const supabase = createClient();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (loading) return;

    setError("");
    setLoading(true);

    try {
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });

      if (signInError) {
        if (signInError.message.includes("Invalid login credentials")) {
          setError("Email hoặc mật khẩu không đúng.");
        } else if (signInError.message.includes("Email not confirmed")) {
          setError("Tài khoản chưa được xác nhận.");
        } else {
          setError("Đăng nhập thất bại. Vui lòng thử lại.");
        }
        setLoading(false);
        return;
      }

      // Register device after successful login
      const deviceRes = await fetch("/api/device/register", {
        method: "POST",
      });
      const deviceData = await deviceRes.json();

      if (!deviceRes.ok || !deviceData.ok) {
        const code = deviceData.code || deviceData.data?.code;

        if (code === "DEVICE_LIMIT") {
          await supabase.auth.signOut();
          router.push("/device-limit");
          return;
        }
        if (code === "ACCOUNT_BLOCKED") {
          await supabase.auth.signOut();
          setError("Tài khoản của bạn đã bị khóa.");
          setLoading(false);
          return;
        }

        // For DEVICE_REVOKED or unknown: try to re-register with new cookie
        if (code === "DEVICE_REVOKED") {
          // Clear old cookie by re-calling register which will detect revoked and create new
          await supabase.auth.signOut();
          router.push("/device-limit");
          return;
        }

        setError("Không thể đăng ký thiết bị. Vui lòng thử lại.");
        setLoading(false);
        return;
      }

      // Đăng ký thành công (bao gồm DEVICE_BYPASSED khi dev mode)
      router.push("/dashboard");
      router.refresh();
    } catch {
      setError("Mất kết nối. Vui lòng kiểm tra mạng và thử lại.");
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-blue-50 via-background to-indigo-50 px-4">
      <div className="w-full max-w-sm animate-fade-in">
        {/* Logo */}
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-primary shadow-lg shadow-primary/25">
            <GraduationCap className="h-8 w-8 text-primary-foreground" />
          </div>
          <h1 className="text-2xl font-bold text-foreground">Quiz Ôn Tập</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Đăng nhập để bắt đầu ôn tập
          </p>
        </div>

        {/* Form */}
        <form
          onSubmit={handleSubmit}
          className="rounded-2xl border bg-card p-6 shadow-sm"
        >
          {error && (
            <div className="mb-4 rounded-lg bg-destructive/10 px-4 py-3 text-sm text-destructive animate-slide-up">
              {error}
            </div>
          )}

          <div className="mb-4">
            <label
              htmlFor="email"
              className="mb-1.5 block text-sm font-medium text-foreground"
            >
              Email
            </label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="email"
              placeholder="name@example.com"
              className="w-full rounded-lg border border-input bg-background px-3 py-2.5 text-sm outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-primary/20"
            />
          </div>

          <div className="mb-6">
            <label
              htmlFor="password"
              className="mb-1.5 block text-sm font-medium text-foreground"
            >
              Mật khẩu
            </label>
            <div className="relative">
              <input
                id="password"
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                autoComplete="current-password"
                placeholder="••••••••"
                className="w-full rounded-lg border border-input bg-background px-3 py-2.5 pr-10 text-sm outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-primary/20"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                aria-label={showPassword ? "Ẩn mật khẩu" : "Hiện mật khẩu"}
              >
                {showPassword ? (
                  <EyeOff className="h-4 w-4" />
                ) : (
                  <Eye className="h-4 w-4" />
                )}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground shadow transition-all hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {loading ? (
              <span className="flex items-center justify-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin" />
                Đang đăng nhập...
              </span>
            ) : (
              "Đăng nhập"
            )}
          </button>
        </form>
      </div>
    </div>
  );
}
