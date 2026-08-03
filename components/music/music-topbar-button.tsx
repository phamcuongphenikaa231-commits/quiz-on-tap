"use client";

import { useCallback } from "react";
import { usePathname } from "next/navigation";
import { useStudyMusicContext } from "./study-music-provider";
import { MusicLibraryPanel } from "./music-library-panel";
import { Headphones, Loader2, AlertCircle } from "lucide-react";

export function MusicTopbarButton() {
  const pathname = usePathname();
  const {
    currentTrack,
    playbackState,
    isPanelOpen,
    setPanelOpen,
  } = useStudyMusicContext();

  const handleToggle = useCallback(() => {
    setPanelOpen(!isPanelOpen);
  }, [isPanelOpen, setPanelOpen]);

  const handleClose = useCallback(() => {
    setPanelOpen(false);
  }, [setPanelOpen]);

  // Hide on restricted routes
  if (
    pathname?.startsWith("/admin") ||
    pathname?.startsWith("/login") ||
    pathname?.startsWith("/device-limit")
  ) {
    return null;
  }

  const isPlaying = playbackState === "playing";
  const isLoading = playbackState === "loading";
  const isPaused = playbackState === "paused";
  const isError = playbackState === "error";

  const getFullLabel = () => {
    if (isLoading) return "Đang tải nhạc...";
    if (isPlaying) return "Đang nghe nhạc";
    if (isPaused) return "Tiếp tục nghe";
    if (isError) return "Không phát được nhạc";
    return "Nghe nhạc khi học";
  };

  const getShortLabel = () => {
    if (isPlaying || isPaused) return "Nhạc";
    return "Nghe nhạc";
  };

  return (
    <div className="music-topbar-wrapper">
      <button
        onClick={handleToggle}
        aria-label="Mở danh sách nhạc"
        aria-expanded={isPanelOpen}
        aria-controls="study-music-panel"
        title={
          isPlaying
            ? `Đang nghe: ${currentTrack?.title || "Nhạc học bài"}`
            : isPaused
            ? `Tạm dừng: ${currentTrack?.title || "Nhạc học bài"}`
            : "Nghe nhạc khi học"
        }
        className={`music-topbar-btn ${isPlaying ? "music-topbar-btn--playing" : ""}`}
      >
        {/* Active playing indicator dot */}
        {isPlaying && (
          <span className="music-topbar-btn__dot" aria-hidden="true" />
        )}

        {/* Icon */}
        <span className="music-topbar-btn__icon" aria-hidden="true">
          {isLoading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : isError ? (
            <AlertCircle className="h-4 w-4 text-amber-300" />
          ) : (
            <Headphones className="h-4 w-4" />
          )}
        </span>

        {/* Equalizer bars (only when playing) */}
        {isPlaying && (
          <span className="music-eq" aria-hidden="true">
            <span className="music-eq__bar music-eq__bar--1" />
            <span className="music-eq__bar music-eq__bar--2" />
            <span className="music-eq__bar music-eq__bar--3" />
          </span>
        )}

        {/* Labels — responsive */}
        <span className="music-topbar-btn__label music-topbar-btn__label--full">
          {getFullLabel()}
        </span>
        <span className="music-topbar-btn__label music-topbar-btn__label--short">
          {getShortLabel()}
        </span>
      </button>

      {/* Library Panel (rendered via React Portal) */}
      <MusicLibraryPanel isOpen={isPanelOpen} onClose={handleClose} />
    </div>
  );
}
