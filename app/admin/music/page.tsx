"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import type { StudyTrack } from "@/lib/music/types";
import { MUSIC_CATEGORIES } from "@/lib/music/types";
import { MusicFormModal } from "@/components/admin/music-form-modal";
import {
  Music,
  Plus,
  Search,
  Play,
  Pause,
  Edit2,
  Trash2,
  Eye,
  EyeOff,
  Loader2,
  AlertCircle,
} from "lucide-react";

export default function AdminMusicPage() {
  const [tracks, setTracks] = useState<StudyTrack[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [search, setSearch] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("all");

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingTrack, setEditingTrack] = useState<StudyTrack | null>(null);

  // Delete modal state
  const [deletingTrack, setDeletingTrack] = useState<StudyTrack | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Inline audio preview state
  const [previewTrackId, setPreviewTrackId] = useState<string | null>(null);
  const [isPlayingPreview, setIsPlayingPreview] = useState(false);
  const previewAudioRef = useRef<HTMLAudioElement | null>(null);

  const fetchTracks = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/admin/music");
      const data = await res.json();
      if (!res.ok || !data.ok) {
        setError(data.message || "Không thể lấy danh sách nhạc");
        setLoading(false);
        return;
      }
      setTracks(data.data.tracks || []);
    } catch {
      setError("Mất kết nối server. Vui lòng thử lại.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchTracks();
  }, [fetchTracks]);

  const stopPreviewAudio = useCallback(() => {
    if (previewAudioRef.current) {
      previewAudioRef.current.pause();
      previewAudioRef.current.src = "";
      previewAudioRef.current = null;
    }
    setPreviewTrackId(null);
    setIsPlayingPreview(false);
  }, []);

  const handleTogglePreview = (track: StudyTrack) => {
    if (previewTrackId === track.id) {
      if (isPlayingPreview && previewAudioRef.current) {
        previewAudioRef.current.pause();
        setIsPlayingPreview(false);
      } else if (previewAudioRef.current) {
        previewAudioRef.current.play().catch(() => {});
        setIsPlayingPreview(true);
      }
      return;
    }

    stopPreviewAudio();

    const audio = new Audio(track.src);
    previewAudioRef.current = audio;
    setPreviewTrackId(track.id);
    setIsPlayingPreview(true);

    audio.play().catch(() => {
      setIsPlayingPreview(false);
    });

    audio.onended = () => {
      setIsPlayingPreview(false);
    };
    audio.onerror = () => {
      setIsPlayingPreview(false);
      alert("Không thể phát thử bài hát này.");
    };
  };

  const handleToggleVisibility = async (track: StudyTrack) => {
    try {
      const nextActive = !track.isActive;
      const res = await fetch(`/api/admin/music/${track.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: nextActive }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        alert(data.message || "Không thể đổi trạng thái bài hát");
        return;
      }
      setTracks((prev) =>
        prev.map((t) => (t.id === track.id ? { ...t, isActive: nextActive } : t))
      );
    } catch {
      alert("Lỗi kết nối. Vui lòng thử lại.");
    }
  };

  const handleDeleteConfirm = async () => {
    if (!deletingTrack) return;
    setIsDeleting(true);

    try {
      const res = await fetch(`/api/admin/music/${deletingTrack.id}`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        alert(data.message || "Không thể xóa bài hát");
        setIsDeleting(false);
        return;
      }

      if (previewTrackId === deletingTrack.id) {
        stopPreviewAudio();
      }

      setTracks((prev) => prev.filter((t) => t.id !== deletingTrack.id));
      setDeletingTrack(null);
    } catch {
      alert("Lỗi kết nối. Vui lòng thử lại.");
    } finally {
      setIsDeleting(false);
    }
  };

  // Filtered tracks
  const filteredTracks = tracks.filter((t) => {
    const matchCat =
      selectedCategory === "all" || t.category === selectedCategory;
    const matchSearch =
      !search.trim() ||
      t.title.toLowerCase().includes(search.toLowerCase()) ||
      t.artist.toLowerCase().includes(search.toLowerCase());
    return matchCat && matchSearch;
  });

  return (
    <div className="space-y-6">
      {/* Header section */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-xl font-bold text-foreground">
            <Music className="h-6 w-6 text-primary" />
            <span>Quản lý nhạc học bài</span>
          </h1>
          <p className="text-xs text-muted-foreground mt-1">
            Quản lý các bản nhạc MP3 phát nền cho học viên khi ôn tập.
          </p>
        </div>

        <button
          onClick={() => {
            setEditingTrack(null);
            setIsModalOpen(true);
          }}
          className="flex items-center justify-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground shadow transition-colors hover:bg-primary/90"
        >
          <Plus className="h-4 w-4" />
          <span>Thêm bài hát</span>
        </button>
      </div>

      {/* Filter & Search bar */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        {/* Search */}
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Tìm theo tên bài hoặc tác giả..."
            className="w-full rounded-xl border bg-card pl-9 pr-4 py-2 text-sm text-foreground outline-none focus:border-primary focus:ring-1 focus:ring-primary"
          />
        </div>

        {/* Category filter pills */}
        <div className="flex flex-wrap gap-1.5">
          <button
            onClick={() => setSelectedCategory("all")}
            className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
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
                className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
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
      </div>

      {/* Main Content */}
      {loading ? (
        <div className="flex min-h-[250px] items-center justify-center rounded-2xl border bg-card">
          <div className="text-center">
            <Loader2 className="mx-auto mb-2 h-7 w-7 animate-spin text-primary" />
            <p className="text-xs text-muted-foreground">Đang tải danh sách nhạc...</p>
          </div>
        </div>
      ) : error ? (
        <div className="rounded-2xl border bg-destructive/10 p-6 text-center text-destructive">
          <AlertCircle className="mx-auto mb-2 h-8 w-8" />
          <p className="font-medium text-sm">{error}</p>
          <button
            onClick={fetchTracks}
            className="mt-3 rounded-lg bg-primary px-4 py-2 text-xs font-medium text-primary-foreground"
          >
            Thử lại
          </button>
        </div>
      ) : filteredTracks.length === 0 ? (
        <div className="rounded-2xl border bg-card p-12 text-center">
          <Music className="mx-auto mb-3 h-10 w-10 text-muted-foreground/40" />
          <p className="font-medium text-foreground">Chưa có bài hát nào</p>
          <p className="text-xs text-muted-foreground mt-1">
            {search || selectedCategory !== "all"
              ? "Không tìm thấy bài hát phù hợp với bộ lọc"
              : "Bấm 'Thêm bài hát' để tải thêm nhạc học bài cho sinh viên."}
          </p>
        </div>
      ) : (
        <>
          {/* Desktop Table View (>= 768px) */}
          <div className="hidden md:block overflow-hidden rounded-2xl border bg-card shadow-sm">
            <table className="w-full text-left text-sm">
              <thead className="border-b bg-secondary/50 text-xs font-semibold text-muted-foreground uppercase">
                <tr>
                  <th className="px-4 py-3">Bài hát</th>
                  <th className="px-4 py-3">Thể loại</th>
                  <th className="px-4 py-3">Thời lượng</th>
                  <th className="px-4 py-3 text-center">Thứ tự</th>
                  <th className="px-4 py-3 text-center">Trạng thái</th>
                  <th className="px-4 py-3 text-right">Hành động</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {filteredTracks.map((track) => {
                  const isCurrentPreview = previewTrackId === track.id && isPlayingPreview;
                  return (
                    <tr key={track.id} className="hover:bg-accent/40 transition-colors">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <button
                            onClick={() => handleTogglePreview(track)}
                            title={isCurrentPreview ? "Tạm dừng nghe thử" : "Nghe thử"}
                            aria-label={`Nghe thử ${track.title}`}
                            className={`flex h-9 w-9 items-center justify-center rounded-full transition-transform hover:scale-105 ${
                              isCurrentPreview
                                ? "bg-primary text-primary-foreground"
                                : "bg-accent text-accent-foreground hover:bg-primary/20"
                            }`}
                          >
                            {isCurrentPreview ? (
                              <Pause className="h-4 w-4" />
                            ) : (
                              <Play className="h-4 w-4 ml-0.5" />
                            )}
                          </button>
                          <div>
                            <p className="font-semibold text-foreground line-clamp-1">
                              {track.title}
                            </p>
                            <p className="text-xs text-muted-foreground line-clamp-1">
                              {track.artist || "Chưa rõ tác giả"}
                            </p>
                          </div>
                        </div>
                      </td>

                      <td className="px-4 py-3">
                        <span className="inline-flex rounded-full bg-accent px-2.5 py-1 text-xs font-medium text-accent-foreground">
                          {track.category}
                        </span>
                      </td>

                      <td className="px-4 py-3 text-xs text-muted-foreground">
                        {track.durationLabel || "--:--"}
                      </td>

                      <td className="px-4 py-3 text-center font-mono text-xs">
                        {track.sortOrder}
                      </td>

                      <td className="px-4 py-3 text-center">
                        {track.isActive !== false ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2.5 py-1 text-xs font-medium text-emerald-600 dark:text-emerald-400">
                            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                            Hiển thị
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2.5 py-1 text-xs font-medium text-muted-foreground">
                            <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground" />
                            Đang ẩn
                          </span>
                        )}
                      </td>

                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            onClick={() => handleToggleVisibility(track)}
                            title={track.isActive !== false ? "Ẩn bài hát" : "Hiện bài hát"}
                            aria-label={track.isActive !== false ? "Ẩn bài hát" : "Hiện bài hát"}
                            className="rounded-lg p-2 text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
                          >
                            {track.isActive !== false ? (
                              <EyeOff className="h-4 w-4" />
                            ) : (
                              <Eye className="h-4 w-4" />
                            )}
                          </button>
                          <button
                            onClick={() => {
                              setEditingTrack(track);
                              setIsModalOpen(true);
                            }}
                            title="Sửa bài hát"
                            aria-label="Sửa bài hát"
                            className="rounded-lg p-2 text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
                          >
                            <Edit2 className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() => setDeletingTrack(track)}
                            title="Xóa bài hát"
                            aria-label="Xóa bài hát"
                            className="rounded-lg p-2 text-destructive hover:bg-destructive/10 transition-colors"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Mobile Cards View (< 768px) */}
          <div className="grid gap-3 md:hidden">
            {filteredTracks.map((track) => {
              const isCurrentPreview = previewTrackId === track.id && isPlayingPreview;
              return (
                <div
                  key={track.id}
                  className="rounded-xl border bg-card p-4 shadow-sm space-y-3"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <button
                        onClick={() => handleTogglePreview(track)}
                        aria-label={`Nghe thử ${track.title}`}
                        className={`flex h-10 w-10 items-center justify-center rounded-full shrink-0 ${
                          isCurrentPreview
                            ? "bg-primary text-primary-foreground"
                            : "bg-accent text-accent-foreground"
                        }`}
                      >
                        {isCurrentPreview ? (
                          <Pause className="h-4 w-4" />
                        ) : (
                          <Play className="h-4 w-4 ml-0.5" />
                        )}
                      </button>
                      <div>
                        <h3 className="font-semibold text-sm text-foreground line-clamp-1">
                          {track.title}
                        </h3>
                        <p className="text-xs text-muted-foreground line-clamp-1">
                          {track.artist || "Chưa rõ tác giả"}
                        </p>
                      </div>
                    </div>

                    {track.isActive !== false ? (
                      <span className="rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-medium text-emerald-600 shrink-0">
                        Hiển thị
                      </span>
                    ) : (
                      <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground shrink-0">
                        Đang ẩn
                      </span>
                    )}
                  </div>

                  <div className="flex items-center justify-between text-xs text-muted-foreground border-t pt-2">
                    <span>Thể loại: <strong className="text-foreground">{track.category}</strong></span>
                    <span>Thứ tự: <strong className="text-foreground">{track.sortOrder}</strong></span>
                    {track.durationLabel && <span>{track.durationLabel}</span>}
                  </div>

                  <div className="flex items-center justify-end gap-2 border-t pt-2">
                    <button
                      onClick={() => handleToggleVisibility(track)}
                      className="flex items-center gap-1 rounded-lg border px-3 py-1.5 text-xs font-medium text-foreground hover:bg-accent"
                    >
                      {track.isActive !== false ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                      <span>{track.isActive !== false ? "Ẩn" : "Hiện"}</span>
                    </button>
                    <button
                      onClick={() => {
                        setEditingTrack(track);
                        setIsModalOpen(true);
                      }}
                      className="flex items-center gap-1 rounded-lg border px-3 py-1.5 text-xs font-medium text-foreground hover:bg-accent"
                    >
                      <Edit2 className="h-3.5 w-3.5" />
                      <span>Sửa</span>
                    </button>
                    <button
                      onClick={() => setDeletingTrack(track)}
                      className="flex items-center gap-1 rounded-lg bg-destructive/10 px-3 py-1.5 text-xs font-medium text-destructive hover:bg-destructive/20"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                      <span>Xóa</span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}

      {/* Add / Edit Modal */}
      <MusicFormModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSaved={fetchTracks}
        initialTrack={editingTrack}
      />

      {/* Delete Confirmation Modal */}
      {deletingTrack && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm animate-fade-in">
          <div className="w-full max-w-sm rounded-2xl border bg-card p-6 shadow-xl text-center space-y-4">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10 text-destructive">
              <Trash2 className="h-6 w-6" />
            </div>
            <div>
              <h3 className="font-bold text-foreground">Xóa bài hát?</h3>
              <p className="text-xs text-muted-foreground mt-1">
                Bạn có chắc chắn muốn xóa bài hát <strong>&quot;{deletingTrack.title}&quot;</strong>? Thao tác này không thể hoàn tác.
              </p>
            </div>
            <div className="flex items-center justify-center gap-3 pt-2">
              <button
                onClick={() => setDeletingTrack(null)}
                disabled={isDeleting}
                className="flex-1 rounded-lg border py-2 text-xs font-medium text-foreground hover:bg-accent"
              >
                Hủy
              </button>
              <button
                onClick={handleDeleteConfirm}
                disabled={isDeleting}
                className="flex-1 flex items-center justify-center gap-1.5 rounded-lg bg-destructive py-2 text-xs font-medium text-destructive-foreground hover:bg-destructive/90 disabled:opacity-50"
              >
                {isDeleting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Xóa vĩnh viễn"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
