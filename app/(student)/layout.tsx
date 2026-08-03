import { MusicProvider } from "@/components/music/music-provider";
import { SnowfallWrapper } from "@/components/snowfall-wrapper";

/**
 * Shared layout for student-facing pages:
 * /dashboard, /mon/[slug], /quiz/[quizId]
 *
 * Wraps children with:
 * - MusicProvider: keeps music playing across page navigations
 * - SnowfallWrapper: snowfall effect (client-only, ssr:false)
 *
 * Admin, login, device-limit are NOT in this route group
 * and do NOT receive these providers.
 */
export default function StudentLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <MusicProvider>
      <SnowfallWrapper />
      {children}
    </MusicProvider>
  );
}
