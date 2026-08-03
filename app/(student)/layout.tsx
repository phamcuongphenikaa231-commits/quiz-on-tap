import { StudyMusicProvider } from "@/components/music/study-music-provider";
import { SnowfallWrapper } from "@/components/snowfall-wrapper";
import { AccountSharingWarning } from "@/components/account-sharing-warning";

/**
 * Shared layout for student-facing pages:
 * /dashboard, /mon/[slug], /quiz/[quizId]
 *
 * Wraps children with:
 * - StudyMusicProvider: single persistent HTMLAudioElement for MP3 background playback
 * - SnowfallWrapper: snowfall effect (client-only, ssr:false)
 * - AccountSharingWarning: modal cảnh báo chia sẻ tài khoản (client-only)
 *
 * Admin, login, device-limit are NOT in this route group
 * and do NOT receive these providers.
 *
 * AccountSharingWarning dùng useState(true) cục bộ:
 * - mount (F5 / tab mới) → isOpen = true → hiện thông báo
 * - chuyển trang nội bộ Next.js → state giữ nguyên → không hiện lại
 * - KHÔNG lưu bất kỳ trạng thái vào localStorage / sessionStorage / cookie / database
 */
export default function StudentLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <StudyMusicProvider>
      <SnowfallWrapper />
      <AccountSharingWarning />
      {children}
    </StudyMusicProvider>
  );
}
