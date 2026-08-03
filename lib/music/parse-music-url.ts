import type { ParsedMusicSource } from "./types";

// Validated hostnames for each provider
const YOUTUBE_HOSTS = new Set([
  "youtube.com",
  "www.youtube.com",
  "youtu.be",
  "music.youtube.com",
]);

const SOUNDCLOUD_HOSTS = new Set([
  "soundcloud.com",
  "www.soundcloud.com",
]);

// Rejected URL schemes
const UNSAFE_SCHEMES = new Set(["javascript:", "data:", "blob:", "file:"]);

function getHostname(raw: string): string | null {
  try {
    const parsed = new URL(raw);
    if (UNSAFE_SCHEMES.has(parsed.protocol + ":") || UNSAFE_SCHEMES.has(parsed.protocol)) {
      return null;
    }
    if (parsed.protocol !== "https:") {
      return null;
    }
    return parsed.hostname.toLowerCase();
  } catch {
    return null;
  }
}

export function parseMusicUrl(raw: string): ParsedMusicSource | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;

  const hostname = getHostname(trimmed);
  if (!hostname) return null;

  try {
    const url = new URL(trimmed);

    // ── YouTube ────────────────────────────────────────────────
    if (YOUTUBE_HOSTS.has(hostname)) {
      // youtu.be/<videoId>
      if (hostname === "youtu.be") {
        const videoId = url.pathname.slice(1).split("/")[0];
        if (videoId && /^[A-Za-z0-9_-]{11}$/.test(videoId)) {
          return { provider: "youtube", kind: "video", videoId };
        }
        return null;
      }

      // playlist: youtube.com/playlist?list=...
      const listParam = url.searchParams.get("list");
      if (
        url.pathname === "/playlist" &&
        listParam &&
        /^[A-Za-z0-9_-]{10,}$/.test(listParam)
      ) {
        return { provider: "youtube", kind: "playlist", playlistId: listParam };
      }

      // watch?v=...  (optionally with &list=)
      const vParam = url.searchParams.get("v");
      if (
        (url.pathname === "/watch" || url.pathname.startsWith("/watch")) &&
        vParam &&
        /^[A-Za-z0-9_-]{11}$/.test(vParam)
      ) {
        // If there's also a list param, prefer playlist mode
        if (listParam && /^[A-Za-z0-9_-]{10,}$/.test(listParam)) {
          return { provider: "youtube", kind: "playlist", playlistId: listParam };
        }
        return { provider: "youtube", kind: "video", videoId: vParam };
      }

      // music.youtube.com/watch?v=...
      if (hostname === "music.youtube.com") {
        const mv = url.searchParams.get("v");
        if (mv && /^[A-Za-z0-9_-]{11}$/.test(mv)) {
          return { provider: "youtube", kind: "video", videoId: mv };
        }
      }

      return null;
    }

    // ── SoundCloud ─────────────────────────────────────────────
    if (SOUNDCLOUD_HOSTS.has(hostname)) {
      // Must have at least 2 path segments: /artist/track
      const parts = url.pathname.split("/").filter(Boolean);
      if (parts.length >= 2) {
        return {
          provider: "soundcloud",
          kind: "track",
          url: trimmed, // pass the original validated URL
        };
      }
      return null;
    }

    return null;
  } catch {
    return null;
  }
}

export function getShortenedLabel(url: string): string {
  try {
    const u = new URL(url);
    const hostname = u.hostname.replace("www.", "");
    const path = u.pathname.replace(/^\//, "").slice(0, 40);
    return `${hostname}/${path}`;
  } catch {
    return url.slice(0, 50);
  }
}
