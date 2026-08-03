"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { MusicContext } from "./music-context";
import type { ParsedMusicSource, PlayerState, RecentLink } from "@/lib/music/types";
import { parseMusicUrl, getShortenedLabel } from "@/lib/music/parse-music-url";
import { STORAGE_KEYS, MAX_RECENT_LINKS } from "@/lib/music/types";
import { DraggableMiniPlayer } from "./draggable-mini-player";

function readStorage<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    if (raw === null) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function writeStorage(key: string, value: unknown): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // ignore storage errors
  }
}

export function MusicProvider({ children }: { children: React.ReactNode }) {
  const [mounted, setMounted] = useState(false);
  const [currentUrl, setCurrentUrl] = useState<string | null>(null);
  const [currentSource, setCurrentSource] = useState<ParsedMusicSource | null>(null);
  const [playerState, setPlayerStateRaw] = useState<PlayerState>("idle");
  const [isPanelOpen, setIsPanelOpenRaw] = useState(false);
  const [recentLinks, setRecentLinks] = useState<RecentLink[]>([]);
  const [errorMessage, setErrorMessage] = useState("");

  const currentUrlRef = useRef<string | null>(null);

  // Hydrate from localStorage after mount (avoids SSR mismatch)
  useEffect(() => {
    const savedUrl = readStorage<string | null>(STORAGE_KEYS.CURRENT_URL, null);
    const savedRecent = readStorage<RecentLink[]>(STORAGE_KEYS.RECENT_LINKS, []);

    if (savedUrl) {
      const parsed = parseMusicUrl(savedUrl);
      if (parsed) {
        setCurrentUrl(savedUrl);
        setCurrentSource(parsed);
        currentUrlRef.current = savedUrl;
        // Do NOT auto-play — player will be in paused state after restore
      }
    }

    setRecentLinks(savedRecent);
    setMounted(true);
  }, []);

  const setPlayerState = useCallback((state: PlayerState) => {
    setPlayerStateRaw(state);
  }, []);

  const setPanelOpen = useCallback((open: boolean) => {
    setIsPanelOpenRaw(open);
  }, []);

  const playUrl = useCallback(
    (url: string) => {
      const parsed = parseMusicUrl(url);
      if (!parsed) {
        setErrorMessage("Link nhạc không hợp lệ. Hiện chỉ hỗ trợ YouTube và SoundCloud.");
        return;
      }

      setErrorMessage("");
      setCurrentUrl(url);
      setCurrentSource(parsed);
      setPlayerStateRaw("loading");
      currentUrlRef.current = url;

      // Save to localStorage
      writeStorage(STORAGE_KEYS.CURRENT_URL, url);
      writeStorage(STORAGE_KEYS.PROVIDER, parsed.provider);

      // Add to recent links
      setRecentLinks((prev) => {
        const label = getShortenedLabel(url);
        const filtered = prev.filter((r) => r.url !== url);
        const next: RecentLink[] = [
          { url, provider: parsed.provider, label, addedAt: Date.now() },
          ...filtered,
        ].slice(0, MAX_RECENT_LINKS);
        writeStorage(STORAGE_KEYS.RECENT_LINKS, next);
        return next;
      });

      // Open panel when playing
      setIsPanelOpenRaw(true);
    },
    []
  );

  const stopMusic = useCallback(() => {
    setCurrentUrl(null);
    setCurrentSource(null);
    setPlayerStateRaw("idle");
    setErrorMessage("");
    currentUrlRef.current = null;
    writeStorage(STORAGE_KEYS.CURRENT_URL, null);
    writeStorage(STORAGE_KEYS.PROVIDER, null);
  }, []);

  const removeRecent = useCallback((url: string) => {
    setRecentLinks((prev) => {
      const next = prev.filter((r) => r.url !== url);
      writeStorage(STORAGE_KEYS.RECENT_LINKS, next);
      return next;
    });
  }, []);

  const clearHistory = useCallback(() => {
    setRecentLinks([]);
    writeStorage(STORAGE_KEYS.RECENT_LINKS, []);
  }, []);

  return (
    <MusicContext.Provider
      value={{
        currentUrl: mounted ? currentUrl : null,
        currentSource: mounted ? currentSource : null,
        playerState: mounted ? playerState : "idle",
        isPanelOpen: mounted ? isPanelOpen : false,
        recentLinks: mounted ? recentLinks : [],
        errorMessage: mounted ? errorMessage : "",
        playUrl,
        stopMusic,
        setPanelOpen,
        setPlayerState,
        setErrorMessage,
        removeRecent,
        clearHistory,
      }}
    >
      {children}
      {/* Persistent Draggable Mini Player (Single Iframe Instance) */}
      {mounted && <DraggableMiniPlayer />}
    </MusicContext.Provider>
  );
}
