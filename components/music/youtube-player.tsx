"use client";

import { useEffect, useRef, useCallback } from "react";
import type { ParsedMusicSource } from "@/lib/music/types";

interface YouTubePlayerProps {
  source: ParsedMusicSource & { provider: "youtube" };
  onStateChange: (state: "playing" | "paused" | "ended" | "buffering") => void;
  onReady: () => void;
  onError: (msg: string) => void;
}

// Extend window type for YT API
declare global {
  interface Window {
    YT?: {
      Player: new (
        element: HTMLElement,
        options: {
          videoId?: string;
          playerVars?: Record<string, string | number>;
          events?: {
            onReady?: (event: { target: YTPlayer }) => void;
            onStateChange?: (event: { data: number }) => void;
            onError?: (event: { data: number }) => void;
          };
        }
      ) => YTPlayer;
      PlayerState: {
        ENDED: number;
        PLAYING: number;
        PAUSED: number;
        BUFFERING: number;
        CUED: number;
      };
    };
    onYouTubeIframeAPIReady?: () => void;
  }
}

interface YTPlayer {
  loadVideoById: (id: string) => void;
  cuePlaylist: (options: { list: string; listType: string }) => void;
  destroy: () => void;
  getIframe: () => HTMLIFrameElement;
}

let ytApiLoaded = false;
let ytApiLoading = false;
const ytReadyCallbacks: (() => void)[] = [];

function loadYouTubeAPI(): Promise<void> {
  return new Promise((resolve) => {
    if (ytApiLoaded && window.YT) {
      resolve();
      return;
    }
    ytReadyCallbacks.push(resolve);
    if (ytApiLoading) return;
    ytApiLoading = true;

    const prevReady = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => {
      ytApiLoaded = true;
      if (prevReady) prevReady();
      ytReadyCallbacks.forEach((cb) => cb());
      ytReadyCallbacks.length = 0;
    };

    const script = document.createElement("script");
    script.src = "https://www.youtube.com/iframe_api";
    script.async = true;
    document.head.appendChild(script);
  });
}

const YT_STATE_MAP: Record<number, "playing" | "paused" | "ended" | "buffering" | null> = {
  0: "ended",
  1: "playing",
  2: "paused",
  3: "buffering",
};

export function YouTubePlayer({ source, onStateChange, onReady, onError }: YouTubePlayerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const playerRef = useRef<YTPlayer | null>(null);

  const onStateChangeRef = useRef(onStateChange);
  const onReadyRef = useRef(onReady);
  const onErrorRef = useRef(onError);
  onStateChangeRef.current = onStateChange;
  onReadyRef.current = onReady;
  onErrorRef.current = onError;

  const initPlayer = useCallback(async () => {
    if (!containerRef.current) return;

    // Destroy existing player before creating new one
    if (playerRef.current) {
      try { playerRef.current.destroy(); } catch { /* ignore */ }
      playerRef.current = null;
    }

    await loadYouTubeAPI();
    if (!containerRef.current || !window.YT) return;

    const isPlaylist = source.kind === "playlist";

    playerRef.current = new window.YT.Player(containerRef.current, {
      playerVars: {
        autoplay: 1,
        rel: 0,
        modestbranding: 1,
        origin: window.location.origin,
        ...(isPlaylist
          ? { listType: "playlist", list: source.playlistId }
          : {}),
      },
      ...(isPlaylist ? {} : { videoId: source.videoId }),
      events: {
        onReady: () => onReadyRef.current(),
        onStateChange: (e) => {
          const mapped = YT_STATE_MAP[e.data];
          if (mapped) onStateChangeRef.current(mapped);
        },
        onError: (e) => {
          const messages: Record<number, string> = {
            2: "Link video không hợp lệ.",
            5: "Trình duyệt không hỗ trợ video này.",
            100: "Video không tồn tại hoặc đã bị xóa.",
            101: "Video này không cho phép phát trên website khác.",
            150: "Video này không cho phép phát trên website khác.",
          };
          onErrorRef.current(messages[e.data] ?? "Không thể tải video. Vui lòng thử lại.");
        },
      },
    });
  }, [source]);

  useEffect(() => {
    initPlayer();
    return () => {
      if (playerRef.current) {
        try { playerRef.current.destroy(); } catch { /* ignore */ }
        playerRef.current = null;
      }
    };
  }, [initPlayer]);

  return (
    <div className="relative w-full rounded-xl overflow-hidden bg-black" style={{ aspectRatio: "16/9" }}>
      <div ref={containerRef} className="w-full h-full" />
    </div>
  );
}
