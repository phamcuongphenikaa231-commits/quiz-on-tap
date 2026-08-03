"use client";

import { Volume2, VolumeX, Volume1 } from "lucide-react";

interface VolumeSliderProps {
  volume: number; // 0..1
  isMuted: boolean;
  onVolumeChange: (vol: number) => void;
  onToggleMute: () => void;
  className?: string;
}

export function VolumeSlider({
  volume,
  isMuted,
  onVolumeChange,
  onToggleMute,
  className = "",
}: VolumeSliderProps) {
  const displayVol = isMuted ? 0 : volume;

  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <button
        onClick={onToggleMute}
        aria-label={isMuted ? "Bật tiếng" : "Tắt tiếng"}
        title={isMuted ? "Bật tiếng" : "Tắt tiếng"}
        className="rounded-lg p-1 text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
      >
        {isMuted || displayVol === 0 ? (
          <VolumeX className="h-4 w-4 text-destructive" />
        ) : displayVol < 0.5 ? (
          <Volume1 className="h-4 w-4" />
        ) : (
          <Volume2 className="h-4 w-4" />
        )}
      </button>

      <input
        type="range"
        min={0}
        max={1}
        step={0.01}
        value={displayVol}
        onChange={(e) => onVolumeChange(parseFloat(e.target.value))}
        aria-label="Điều chỉnh âm lượng"
        className="h-1.5 w-20 cursor-pointer appearance-none rounded-lg bg-secondary accent-primary transition-all"
      />
    </div>
  );
}
