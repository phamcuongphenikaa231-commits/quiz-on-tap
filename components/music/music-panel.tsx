"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { useMusicContext } from "./music-context";
import { parseMusicUrl } from "@/lib/music/parse-music-url";
import {
  Headphones,
  X,
  Play,
  Clipboard,
  Clock,
  Youtube,
  Music2,
  Loader2,
  AlertCircle,
  StopCircle,
  Minimize2,
} from "lucide-react";

interface MusicPanelProps {
  isOpen: boolean;
  onClose: () => void;
}

export function MusicPanel({ isOpen, onClose }: MusicPanelProps) {
  const {
    currentUrl,
    currentSource,
    playerState,
    recentLinks,
    errorMessage,
    playUrl,
    stopMusic,
    setPanelOpen,
    removeRecent,
    clearHistory,
  } = useMusicContext();

  const [inputUrl, setInputUrl] = useState("");
  const [inputError, setInputError] = useState("");
  const [isMobile, setIsMobile] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Detect mobile
  useEffect(() => {
    const mq = window.matchMedia("(max-width: 639px)");
    setIsMobile(mq.matches);
    const h = (e: MediaQueryListEvent) => setIsMobile(e.matches);
    mq.addEventListener("change", h);
    return () => mq.removeEventListener("change", h);
  }, []);

  // Close on Escape
  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [isOpen, onClose]);

  // Close on outside click (desktop popover only)
  useEffect(() => {
    if (!isOpen || isMobile) return;
    const handler = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    const t = setTimeout(() => document.addEventListener("mousedown", handler), 100);
    return () => {
      clearTimeout(t);
      document.removeEventListener("mousedown", handler);
    };
  }, [isOpen, isMobile, onClose]);

  // Focus input when panel opens
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [isOpen]);

  const handlePlay = useCallback(() => {
    const trimmed = inputUrl.trim();
    if (!trimmed) return;
    const parsed = parseMusicUrl(trimmed);
    if (!parsed) {
      setInputError("Link không hợp lệ. Chỉ hỗ trợ YouTube và SoundCloud (HTTPS).");
      return;
    }
    setInputError("");
    playUrl(trimmed);
    setInputUrl("");
  }, [inputUrl, playUrl]);

  const handlePaste = useCallback(async () => {
    try {
      const text = await navigator.clipboard.readText();
      setInputUrl(text);
      setInputError("");
    } catch {
      setInputError("Trình duyệt chưa cho phép đọc clipboard.");
    }
  }, []);

  if (!isOpen) return null;

  const panelContent = (
    <div
      ref={panelRef}
      id="study-music-panel"
      role="dialog"
      aria-label="Nghe nhạc khi học"
      className={`music-panel ${isMobile ? "music-panel--mobile" : "music-panel--desktop"}`}
    >
      {/* Drag handle (mobile) */}
      {isMobile && (
        <div className="music-panel__drag-handle" aria-hidden="true">
          <div className="music-panel__drag-bar" />
        </div>
      )}

      {/* Header */}
      <div className="music-panel__header">
        <div className="music-panel__header-info">
          <Headphones className="music-panel__header-icon" aria-hidden="true" />
          <div>
            <h2 className="music-panel__title">Nghe nhạc khi học</h2>
            <p className="music-panel__subtitle">
              Dán link nhạc yêu thích và học tập theo cách của bạn.
            </p>
          </div>
        </div>
        <button
          onClick={onClose}
          aria-label="Đóng trình phát nhạc"
          className="music-panel__close-btn"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* URL Input */}
      <div className="music-panel__input-section">
        <div className="music-panel__input-row">
          <input
            ref={inputRef}
            type="url"
            value={inputUrl}
            onChange={(e) => {
              setInputUrl(e.target.value);
              setInputError("");
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") handlePlay();
            }}
            placeholder="Dán link YouTube hoặc SoundCloud..."
            aria-label="Nhập link nhạc"
            className="music-panel__input"
          />
          {typeof navigator !== "undefined" && "clipboard" in navigator && (
            <button
              onClick={handlePaste}
              aria-label="Dán link từ clipboard"
              title="Dán từ clipboard"
              className="music-panel__paste-btn"
            >
              <Clipboard className="h-4 w-4" />
            </button>
          )}
        </div>

        {inputError && (
          <p className="music-panel__input-error">
            <AlertCircle className="h-3.5 w-3.5" aria-hidden="true" />
            {inputError}
          </p>
        )}

        <button
          onClick={handlePlay}
          disabled={!inputUrl.trim() || playerState === "loading"}
          aria-label="Phát nhạc"
          className="music-panel__play-btn"
        >
          {playerState === "loading" && currentUrl === inputUrl ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Đang tải...
            </>
          ) : (
            <>
              <Play className="h-4 w-4" />
              Phát nhạc
            </>
          )}
        </button>

        <p className="music-panel__hint">
          Hỗ trợ YouTube, YouTube Music, playlist YouTube và SoundCloud.
        </p>
      </div>

      {/* Global Error */}
      {errorMessage && (
        <div className="music-panel__error-banner">
          <AlertCircle className="h-4 w-4 flex-shrink-0" aria-hidden="true" />
          <span>{errorMessage}</span>
        </div>
      )}

      {/* Active Track Controls Summary (Player iframe is persistent in DraggableMiniPlayer) */}
      {currentSource && (
        <div className="music-panel__player-section">
          <div className="music-panel__player-header">
            <span className="music-panel__player-label">
              {currentSource.provider === "youtube" ? (
                <><Youtube className="h-3.5 w-3.5" aria-hidden="true" /> YouTube</>
              ) : (
                <><Music2 className="h-3.5 w-3.5" aria-hidden="true" /> SoundCloud</>
              )}
            </span>
            <div className="music-panel__player-status">
              {playerState === "loading" && (
                <span className="music-panel__status music-panel__status--loading">
                  <Loader2 className="h-3 w-3 animate-spin" /> Đang tải...
                </span>
              )}
              {playerState === "playing" && (
                <span className="music-panel__status music-panel__status--playing">
                  ● Đang phát
                </span>
              )}
              {playerState === "paused" && (
                <span className="music-panel__status music-panel__status--paused">
                  ⏸ Tạm dừng
                </span>
              )}
            </div>
            <button
              onClick={() => setPanelOpen(false)}
              aria-label="Thu nhỏ thành Mini-Player"
              title="Thu nhỏ Mini-Player"
              className="music-panel__close-btn"
            >
              <Minimize2 className="h-4 w-4" />
            </button>
            <button
              onClick={stopMusic}
              aria-label="Dừng nhạc và đóng trình phát"
              title="Dừng nhạc"
              className="music-panel__stop-btn"
            >
              <StopCircle className="h-4 w-4" />
            </button>
          </div>
          <p className="text-xs text-muted-foreground bg-secondary/50 p-2 rounded-lg">
            Nhạc đang phát ở Trình phát nổi (Mini-Player). Bạn có thể kéo thả trình phát tới vị trí mong muốn.
          </p>
        </div>
      )}

      {/* Recent Links */}
      {recentLinks.length > 0 && (
        <div className="music-panel__recent">
          <div className="music-panel__recent-header">
            <span className="music-panel__recent-title">
              <Clock className="h-3.5 w-3.5" aria-hidden="true" />
              Link gần đây
            </span>
            <button
              onClick={clearHistory}
              aria-label="Xóa lịch sử nghe nhạc"
              className="music-panel__clear-btn"
            >
              Xóa lịch sử
            </button>
          </div>
          <ul className="music-panel__recent-list" role="list">
            {recentLinks.map((link) => (
              <li key={link.url} className="music-panel__recent-item">
                <button
                  onClick={() => playUrl(link.url)}
                  aria-label={`Phát lại ${link.label}`}
                  className="music-panel__recent-play"
                >
                  {link.provider === "youtube" ? (
                    <Youtube className="h-3.5 w-3.5 flex-shrink-0 text-red-500" aria-hidden="true" />
                  ) : (
                    <Music2 className="h-3.5 w-3.5 flex-shrink-0 text-orange-500" aria-hidden="true" />
                  )}
                  <span className="music-panel__recent-label">{link.label}</span>
                </button>
                <button
                  onClick={() => removeRecent(link.url)}
                  aria-label={`Xóa ${link.label} khỏi lịch sử`}
                  className="music-panel__recent-remove"
                >
                  <X className="h-3 w-3" />
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );

  // Mobile: render as bottom sheet with backdrop
  if (isMobile) {
    return (
      <>
        <div
          className="music-panel__backdrop"
          aria-hidden="true"
          onClick={onClose}
        />
        {panelContent}
      </>
    );
  }

  // Desktop: popover (positioned by CSS)
  return panelContent;
}
