import { requireUser } from "@/lib/auth/require-user";
import { requireDevice } from "@/lib/device/require-device";
import { SubjectCard } from "@/components/subject-card";
import { LogOut, GraduationCap } from "lucide-react";
import { MusicTopbarButton } from "@/components/music/music-topbar-button";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const startedAt = performance.now();
  const { user, supabase } = await requireUser();
  await requireDevice();

  // Run profile and user_subjects queries in parallel using Promise.all
  const [profileRes, subjectsRes] = await Promise.all([
    supabase
      .from("profiles")
      .select("full_name, role")
      .eq("id", user.id)
      .single(),
    supabase
      .from("user_subjects")
      .select("subject_id, subjects!inner(id, title, slug, description)")
      .eq("user_id", user.id)
      .eq("is_active", true)
      .eq("subjects.is_published", true),
  ]);

  const profile = profileRes.data;
  const userSubjects = subjectsRes.data;

  console.log({
    route: "/dashboard",
    durationMs: Math.round(performance.now() - startedAt),
  });

  const subjects = (userSubjects || [])
    .map((us) => {
      const s = us.subjects as unknown as {
        id: string;
        title: string;
        slug: string;
        description: string;
      } | null;
      return s;
    })
    .filter((s): s is NonNullable<typeof s> => s !== null);

  const isAdmin = profile?.role === "admin";

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header data-floating-obstacle="topbar" className="sticky top-0 z-40 border-b bg-card/80 backdrop-blur-sm">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-4 py-3">
          <div className="flex items-center gap-2">
            <GraduationCap className="h-5 w-5 text-primary" />
            <span className="font-semibold text-foreground">Quiz Ôn Tập</span>
          </div>
          <div className="flex items-center gap-2 sm:gap-3">
            {/* Music button */}
            <MusicTopbarButton />
            {isAdmin && (
              <a
                href="/admin"
                className="rounded-md bg-accent px-3 py-1.5 text-xs font-medium text-accent-foreground transition-colors hover:bg-accent/80"
              >
                Admin
              </a>
            )}
            <form action="/api/auth/signout" method="POST">
              <button
                type="submit"
                className="flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
              >
                <LogOut className="h-4 w-4" />
                <span className="hidden sm:inline">Đăng xuất</span>
              </button>
            </form>
          </div>
        </div>
      </header>

      {/* Content */}
      <main className="mx-auto max-w-3xl px-4 py-6">
        <h1 className="mb-1 text-xl font-bold text-foreground">
          Môn học của tôi
        </h1>
        <p className="mb-6 text-sm text-muted-foreground">
          Xin chào, {profile?.full_name || user.email}
        </p>

        {subjects.length === 0 ? (
          <div className="rounded-2xl border bg-card p-8 text-center animate-fade-in">
            <p className="mb-2 text-muted-foreground">
              Bạn chưa được cấp môn học nào.
            </p>
            <p className="text-sm text-muted-foreground">
              Vui lòng liên hệ hỗ trợ để được cấp quyền truy cập.
            </p>
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {subjects.map((subject) => (
              <SubjectCard
                key={subject.id}
                title={subject.title}
                slug={subject.slug}
                description={subject.description}
              />
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
