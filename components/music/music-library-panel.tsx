"use client";

import { useEffect, useRef, useState, useMemo } from "react";
import { createPortal } from "react-dom";
import { useStudyMusicContext } from "./study-music-provider";
import { MUSIC_CATEGORIES } from "@/lib/music/types";
import { MusicNowPlaying } from "./music-now-playing";
import {
  Headphones,
  X,
  Play,
  Pause,
  Search,
  Music,
  Loader2,
  AlertCircle,
  RefreshCw,
} from "lucide-react";

interface MusicLibraryPanelProps {
  isOpen: boolean;
  onClose: () => void;
}

export function MusicLibraryPanel({ isOpen, onClose }: MusicLibraryPanelProps) {
  const {
    tracks,
    currentTrack,
    playbackState,
    errorMessage,
    isLoadingTracks,
    playTrack,
    reloadTracks,
  } = useStudyMusicContext();

  const [mounted, setMounted] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [search, setSearch] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("all");

  const panelRef = useRef<HTMLDivElement>(null);

  // Hydrate mounted state for portal
  useEffect(() => {
    setMounted(true);
  }, []);

  // Detect mobile (< 768px)
  useEffect(() => {
    const mq = window.matchMedia("(max-width: 767px)");
    setIsMobile(mq.matches);
    const h = (e: MediaQueryListEvent) => setIsMobile(e.matches);
    mq.addEventListener("change", h);
    return () => mq.removeEventListener("change", h);
  }, []);

  // Body scroll lock on mobile
  useEffect(() => {
    if (!isOpen || !isMobile) return;
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = originalOverflow;
    };
  }, [isOpen, isMobile]);

  // Close on Escape
  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [isOpen, onClose]);

  // Close on outside click (desktop)
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

  // Filter tracks by category and search term
  const filteredTracks = useMemo(() => {
    return tracks.filter((t) => {
      const matchCat =
        selectedCategory === "all" || t.category === selectedCategory;
      const matchSearch =
        !search.trim() ||
        t.title.toLowerCase().includes(search.toLowerCase()) ||
        t.artist.toLowerCase().includes(search.toLowerCase());
      return matchCat && matchSearch;
    });
  }, [tracks, selectedCategory, search]);

  if (!isOpen || !mounted) return null;

  const panelContent = (
    <>
      {/* Mobile Backdrop */}
      {isMobile && (
        <div
          className="music-panel__backdrop"
          aria-hidden="true"
          onClick={onClose}
        />
      )}

      {/* Panel Container */}
      <div
        ref={panelRef}
        id="study-music-panel"
        role="dialog"
        aria-label="Nhạc học bài"
        className={`music-panel ${isMobile ? "music-panel--mobile" : "music-panel--desktop"}`}
      >
        {/* Sticky Header */}
        <div className="music-panel__sticky-header">
          {isMobile && (
            <div className="music-panel__drag-handle" aria-hidden="true">
              <div className="music-panel__drag-bar" />
            </div>
          )}
          <div className="music-panel__header">
            <div className="music-panel__header-info">
              <Headphones className="music-panel__header-icon" aria-hidden="true" />
              <div>
                <h2 className="music-panel__title">Nhạc học bài</h2>
                <p className="music-panel__subtitle">
                  Chọn một bản nhạc để tập trung hơn khi làm bài.
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              aria-label="Đóng danh sách nhạc"
              title="Đóng danh sách nhạc"
              className="music-panel__close-btn"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Content Body */}
        <div className="p-4 space-y-4">
          {/* Now Playing Control Bar if a track is active */}
          <MusicNowPlaying />

          {/* Search & Refresh */}
          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Tìm bài hát, tác giả..."
                aria-label="Tìm bài hát"
                className="w-full rounded-lg border bg-background pl-8 pr-3 py-1.5 text-xs text-foreground outline-none focus:border-primary"
              />
            </div>
            <button
              onClick={() => reloadTracks()}
              title="Tải lại danh sách bài hát"
              aria-label="Tải lại danh sách nhạc"
              className="rounded-lg border p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground transition-colors shrink-0"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${isLoadingTracks ? "animate-spin" : ""}`} />
            </button>
          </div>

          {/* Category Filter Pills */}
          <div className="flex flex-wrap gap-1">
            <button
              onClick={() => setSelectedCategory("all")}
              className={`rounded-full px-2.5 py-1 text-[11px] font-medium transition-colors ${
                selectedCategory === "all"
                  ? "bg-primary text-primary-foreground"
                  : "bg-secondary text-secondary-foreground hover:bg-accent"
              }`}
            >
              Tất cả ({tracks.length})
            </button>
            {MUSIC_CATEGORIES.map((cat) => {
              const count = tracks.filter((t) => t.category === cat).length;
              if (count === 0 && selectedCategory !== cat) return null;
              return (
                <button
                  key={cat}
                  onClick={() => setSelectedCategory(cat)}
                  className={`rounded-full px-2.5 py-1 text-[11px] font-medium transition-colors ${
                    selectedCategory === cat
                      ? "bg-primary text-primary-foreground"
                      : "bg-secondary text-secondary-foreground hover:bg-accent"
                  }`}
                >
                  {cat} ({count})
                </button>
              );
            })}
          </div>

          {/* Global Error Banner */}
          {errorMessage && (
            <div className="flex items-center gap-2 rounded-lg bg-destructive/10 p-2.5 text-xs text-destructive">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* Track List */}
          {isLoadingTracks && tracks.length === 0 ? (
            <div className="py-8 text-center">
              <Loader2 className="mx-auto mb-2 h-6 w-6 animate-spin text-primary" />
              <p className="text-xs text-muted-foreground">Đang tải danh sách nhạc...</p>
            </div>
          ) : filteredTracks.length === 0 ? (
            <div className="py-8 text-center rounded-xl border border-dashed p-4">
              <Music className="mx-auto mb-2 h-8 w-8 text-muted-foreground/30" />
              <p className="text-xs font-medium text-muted-foreground">
                {search || selectedCategory !== "all"
                  ? "Không tìm thấy bài hát phù hợp"
                  : "Hiện chưa có nhạc học bài."}
              </p>
            </div>
          ) : (
            <div className="space-y-1 max-h-[280px] overflow-y-auto pr-1">
              {filteredTracks.map((track) => {
                const isSelected = currentTrack?.id === track.id;
                const isPlayingThis = isSelected && playbackState === "playing";
                const isLoadingThis = isSelected && playbackState === "loading";

                return (
                  <div
                    key={track.id}
                    onClick={() => playTrack(track)}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        playTrack(track);
                      }
                    }}
                    className={`group flex items-center justify-between gap-3 min-h-[56px] p-2.5 rounded-xl border text-left cursor-pointer transition-all ${
                      isSelected
                        ? "border-primary/40 bg-primary/5 shadow-sm"
                        : "border-transparent bg-secondary/40 hover:bg-accent"
                    }`}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      {/* Play / Pause button */}
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          playTrack(track);
                        }}
                        aria-label={
                          isPlayingThis
                            ? `Tạm dừng bài ${track.title}`
                            : `Phát bài ${track.title}`
                        }
                        title={isPlayingThis ? "Tạm dừng" : "Phát bài này"}
                        className={`flex h-9 w-9 items-center justify-center rounded-full shrink-0 transition-transform group-hover:scale-105 ${
                          isSelected
                            ? "bg-primary text-primary-foreground"
                            : "bg-background text-foreground group-hover:bg-primary group-hover:text-primary-foreground"
                        }`}
                      >
                        {isLoadingThis ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : isPlayingThis ? (
                          <Pause className="h-4 w-4" />
                        ) : (
                          <Play className="h-4 w-4 ml-0.5" />
                        )}
                      </button>

                      <div className="min-w-0">
                        <p
                          className={`font-semibold text-xs truncate ${
                            isSelected ? "text-primary" : "text-foreground"
                          }`}
                        >
                          {track.title}
                        </p>
                        <p className="text-[11px] text-muted-foreground truncate">
                          {track.artist || "Chưa rõ tác giả"} • {track.category}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      {/* Equalizer animation when playing this track */}
                      {isPlayingThis && (
                        <span className="music-eq" aria-hidden="true">
                          <span className="music-eq__bar music-eq__bar--1" />
                          <span className="music-eq__bar music-eq__bar--2" />
                          <span className="music-eq__bar music-eq__bar--3" />
                        </span>
                      )}

                      {track.durationLabel && (
                        <span className="text-[11px] text-muted-foreground font-mono">
                          {track.durationLabel}
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </>
  );

  return createPortal(panelContent, document.body);
}
