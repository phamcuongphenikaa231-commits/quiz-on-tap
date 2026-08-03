"use client";

import { useCallback, useRef } from "react";
import { useMusicContext } from "./music-context";
import { MusicPanel } from "./music-panel";
import { Headphones, Loader2 } from "lucide-react";

export function MusicTopbarButton() {
  const { playerState, isPanelOpen, setPanelOpen } = useMusicContext();
  const btnRef = useRef<HTMLButtonElement>(null);

  const handleToggle = useCallback(() => {
    setPanelOpen(!isPanelOpen);
  }, [isPanelOpen, setPanelOpen]);

  const handleClose = useCallback(() => {
    setPanelOpen(false);
  }, [setPanelOpen]);

  const isPlaying = playerState === "playing";
  const isLoading = playerState === "loading";
  const isPaused = playerState === "paused";

  return (
    <div className="music-topbar-wrapper">
      <button
        ref={btnRef}
        onClick={handleToggle}
        aria-label="Nghe nhạc khi học"
        aria-expanded={isPanelOpen}
        aria-controls="study-music-panel"
        title={
          isPlaying
            ? "Nhạc đang phát — bấm để mở trình phát"
            : isPaused
            ? "Tiếp tục nghe — bấm để mở trình phát"
            : "Nghe nhạc khi học"
        }
        className={`music-topbar-btn ${isPlaying ? "music-topbar-btn--playing" : ""}`}
      >
        {/* Playing indicator dot */}
        {isPlaying && (
          <span className="music-topbar-btn__dot" aria-hidden="true" />
        )}

        {/* Icon + Equalizer */}
        <span className="music-topbar-btn__icon" aria-hidden="true">
          {isLoading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
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

        {/* Label — responsive */}
        <span className="music-topbar-btn__label music-topbar-btn__label--full">
          {isLoading
            ? "Đang tải nhạc..."
            : isPlaying
            ? "Đang nghe nhạc"
            : isPaused
            ? "Tiếp tục nghe"
            : "Nghe nhạc khi học"}
        </span>
        <span className="music-topbar-btn__label music-topbar-btn__label--short">
          {isPlaying || isPaused ? "Nhạc" : "Nghe nhạc"}
        </span>
      </button>

      {/* Panel positioned relative to this wrapper */}
      <MusicPanel isOpen={isPanelOpen} onClose={handleClose} />
    </div>
  );
}
