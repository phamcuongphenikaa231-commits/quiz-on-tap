"use client";

import { useStudyMusicContext } from "./study-music-provider";
import { VolumeSlider } from "./volume-slider";
import {
  Play,
  Pause,
  SkipBack,
  SkipForward,
  Repeat,
  Repeat1,
  Loader2,
  StopCircle,
  Music2,
} from "lucide-react";

function formatTime(seconds: number): string {
  if (isNaN(seconds) || seconds <= 0) return "00:00";
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);

  const pad = (n: number) => n.toString().padStart(2, "0");

  if (h > 0) {
    return `${pad(h)}:${pad(m)}:${pad(s)}`;
  }
  return `${pad(m)}:${pad(s)}`;
}

export function MusicNowPlaying() {
  const {
    currentTrack,
    playbackState,
    currentTime,
    duration,
    volume,
    isMuted,
    repeatMode,
    togglePlayPause,
    nextTrack,
    prevTrack,
    stopMusic,
    seekTo,
    setVolume,
    toggleMute,
    cycleRepeatMode,
  } = useStudyMusicContext();

  if (!currentTrack) return null;

  const isPlaying = playbackState === "playing";
  const isLoading = playbackState === "loading";

  return (
    <div className="rounded-xl border bg-card p-3 sm:p-4 shadow-sm space-y-3">
      {/* Track Info Header */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <Music2 className="h-4 w-4" />
          </div>
          <div className="min-w-0">
            <h4 className="font-semibold text-xs sm:text-sm text-foreground truncate">
              {currentTrack.title}
            </h4>
            <p className="text-[11px] text-muted-foreground truncate">
              {currentTrack.artist || "Nhạc học bài"} • {currentTrack.category}
            </p>
          </div>
        </div>

        <button
          onClick={stopMusic}
          aria-label="Dừng nhạc"
          title="Dừng nhạc"
          className="rounded-lg p-1.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-colors shrink-0"
        >
          <StopCircle className="h-4 w-4" />
        </button>
      </div>

      {/* Progress Bar & Time */}
      <div className="space-y-1">
        <input
          type="range"
          min={0}
          max={duration || 100}
          step={0.1}
          value={currentTime}
          onChange={(e) => seekTo(parseFloat(e.target.value))}
          aria-label="Thanh tiến độ bài hát"
          className="h-1.5 w-full cursor-pointer appearance-none rounded-lg bg-secondary accent-primary transition-all"
        />
        <div className="flex items-center justify-between text-[10px] font-mono text-muted-foreground">
          <span>{formatTime(currentTime)}</span>
          <span>{currentTrack.durationLabel || formatTime(duration)}</span>
        </div>
      </div>

      {/* Control Buttons & Volume */}
      <div className="flex items-center justify-between gap-2 pt-1">
        {/* Repeat Mode Button */}
        <button
          onClick={cycleRepeatMode}
          aria-label={
            repeatMode === "one"
              ? "Đang lặp 1 bài"
              : repeatMode === "all"
              ? "Đang lặp danh sách"
              : "Tắt lặp"
          }
          title={
            repeatMode === "one"
              ? "Đang lặp 1 bài"
              : repeatMode === "all"
              ? "Đang lặp danh sách"
              : "Tắt lặp"
          }
          className={`rounded-lg p-1.5 text-xs transition-colors ${
            repeatMode !== "off"
              ? "bg-primary/10 text-primary font-medium"
              : "text-muted-foreground hover:bg-accent hover:text-foreground"
          }`}
        >
          {repeatMode === "one" ? (
            <Repeat1 className="h-4 w-4" />
          ) : (
            <Repeat className="h-4 w-4" />
          )}
        </button>

        {/* Prev / Play / Next */}
        <div className="flex items-center gap-1.5">
          <button
            onClick={prevTrack}
            aria-label="Bài trước"
            title="Bài trước"
            className="rounded-lg p-2 text-foreground hover:bg-accent transition-colors"
          >
            <SkipBack className="h-4 w-4" />
          </button>

          <button
            onClick={togglePlayPause}
            aria-label={isPlaying ? "Tạm dừng nhạc" : "Phát nhạc"}
            title={isPlaying ? "Tạm dừng" : "Phát nhạc"}
            className="flex h-9 w-9 items-center justify-center rounded-full bg-primary text-primary-foreground shadow transition-transform hover:scale-105"
          >
            {isLoading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : isPlaying ? (
              <Pause className="h-4 w-4" />
            ) : (
              <Play className="h-4 w-4 ml-0.5" />
            )}
          </button>

          <button
            onClick={nextTrack}
            aria-label="Bài tiếp theo"
            title="Bài tiếp theo"
            className="rounded-lg p-2 text-foreground hover:bg-accent transition-colors"
          >
            <SkipForward className="h-4 w-4" />
          </button>
        </div>

        {/* Volume Slider */}
        <VolumeSlider
          volume={volume}
          isMuted={isMuted}
          onVolumeChange={setVolume}
          onToggleMute={toggleMute}
        />
      </div>
    </div>
  );
}
