import { requireAdmin } from "@/lib/auth/require-admin";
import Link from "next/link";
import { FolderTree, Users, FileSpreadsheet, ArrowLeft, ShieldCheck, Music } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireAdmin();

  return (
    <div className="min-h-screen bg-background">
      {/* Header Admin */}
      <header className="sticky top-0 z-40 border-b bg-card/80 backdrop-blur-sm">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3">
          <div className="flex items-center gap-3">
            <Link
              href="/dashboard"
              className="flex items-center gap-1 text-sm text-muted-foreground transition-colors hover:text-foreground"
            >
              <ArrowLeft className="h-4 w-4" />
              <span className="hidden sm:inline">Quay lại Dashboard</span>
            </Link>
            <div className="h-4 w-px bg-border hidden sm:block" />
            <div className="flex items-center gap-1.5 font-bold text-foreground">
              <ShieldCheck className="h-5 w-5 text-primary" />
              <span>Quản trị Quiz</span>
            </div>
          </div>

          <nav className="flex items-center gap-1">
            <Link
              href="/admin/content"
              className="flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium text-foreground hover:bg-accent transition-colors"
            >
              <FolderTree className="h-4 w-4 text-primary" />
              <span className="hidden sm:inline">Nội dung</span>
            </Link>
            <Link
              href="/admin/music"
              className="flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium text-foreground hover:bg-accent transition-colors"
            >
              <Music className="h-4 w-4 text-purple-500" />
              <span className="hidden sm:inline">Nhạc học bài</span>
            </Link>
            <Link
              href="/admin/users"
              className="flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium text-foreground hover:bg-accent transition-colors"
            >
              <Users className="h-4 w-4 text-blue-500" />
              <span className="hidden sm:inline">Học viên</span>
            </Link>
            <Link
              href="/admin/import"
              className="flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium text-foreground hover:bg-accent transition-colors"
            >
              <FileSpreadsheet className="h-4 w-4 text-emerald-500" />
              <span className="hidden sm:inline">Nhập câu hỏi</span>
            </Link>
          </nav>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 py-6">{children}</main>
    </div>
  );
}
