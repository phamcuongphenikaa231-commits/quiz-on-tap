"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import type { StudyTrack } from "@/lib/music/types";
import { MUSIC_CATEGORIES } from "@/lib/music/types";
import {
  X,
  Play,
  Pause,
  Loader2,
  CheckCircle2,
  AlertCircle,
  Music,
} from "lucide-react";

interface MusicFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSaved: () => void;
  initialTrack?: StudyTrack | null;
}

export function MusicFormModal({
  isOpen,
  onClose,
  onSaved,
  initialTrack,
}: MusicFormModalProps) {
  const [title, setTitle] = useState("");
  const [artist, setArtist] = useState("");
  const [category, setCategory] = useState<string>("Lo-fi");
  const [customCategory, setCustomCategory] = useState("");
  const [audioUrl, setAudioUrl] = useState("");
  const [durationLabel, setDurationLabel] = useState("");
  const [sortOrder, setSortOrder] = useState<number>(0);
  const [isActive, setIsActive] = useState(true);

  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState("");

  // Audio preview state
  const [testing, setTesting] = useState(false);
  const [testState, setTestState] = useState<"idle" | "testing" | "playing" | "paused" | "success" | "error">("idle");
  const [testMessage, setTestMessage] = useState("");
  const testAudioRef = useRef<HTMLAudioElement | null>(null);

  const stopTestAudio = useCallback(() => {
    if (testAudioRef.current) {
      testAudioRef.current.pause();
      testAudioRef.current.src = "";
      testAudioRef.current = null;
    }
    setTestState("idle");
    setTestMessage("");
    setTesting(false);
  }, []);

  useEffect(() => {
    if (initialTrack) {
      setTitle(initialTrack.title || "");
      setArtist(initialTrack.artist || "");
      const isKnown = MUSIC_CATEGORIES.includes(initialTrack.category as (typeof MUSIC_CATEGORIES)[number]);
      if (isKnown) {
        setCategory(initialTrack.category);
        setCustomCategory("");
      } else {
        setCategory("Khác");
        setCustomCategory(initialTrack.category || "");
      }
      setAudioUrl(initialTrack.src || "");
      setDurationLabel(initialTrack.durationLabel || "");
      setSortOrder(initialTrack.sortOrder ?? 0);
      setIsActive(initialTrack.isActive !== false);
    } else {
      setTitle("");
      setArtist("");
      setCategory("Lo-fi");
      setCustomCategory("");
      setAudioUrl("");
      setDurationLabel("");
      setSortOrder(0);
      setIsActive(true);
    }
    setFormError("");
    stopTestAudio();
  }, [initialTrack, isOpen, stopTestAudio]);

  const handleClose = () => {
    stopTestAudio();
    onClose();
  };

  const handleTestAudio = async () => {
    const trimmed = audioUrl.trim();
    if (!trimmed) {
      setTestState("error");
      setTestMessage("Vui lòng nhập link âm thanh HTTPS trước khi nghe thử.");
      return;
    }

    if (!/^https:\/\//i.test(trimmed)) {
      setTestState("error");
      setTestMessage("Link âm thanh phải bắt đầu bằng https://");
      return;
    }

    // Toggle play/pause if already testing this URL
    if (testAudioRef.current && testAudioRef.current.src === trimmed) {
      if (testState === "playing") {
        testAudioRef.current.pause();
        setTestState("paused");
      } else {
        try {
          await testAudioRef.current.play();
          setTestState("playing");
        } catch {
          setTestState("error");
          setTestMessage("Không thể phát âm thanh. Trình duyệt có thể đã chặn tự động phát.");
        }
      }
      return;
    }

    stopTestAudio();
    setTesting(true);
    setTestState("testing");
    setTestMessage("Đang kiểm tra metadata...");

    const audio = new Audio();
    audio.preload = "metadata";
    audio.src = trimmed;
    testAudioRef.current = audio;

    audio.onloadedmetadata = async () => {
      setTesting(false);
      setTestState("success");
      setTestMessage("Link âm thanh hợp lệ.");
      try {
        await audio.play();
        setTestState("playing");
      } catch {
        setTestState("success");
        setTestMessage("Link hợp lệ! Bấm Nghe thử lần nữa để phát.");
      }
    };

    audio.onerror = () => {
      setTesting(false);
      setTestState("error");
      setTestMessage("Không thể tải file âm thanh từ đường dẫn này.");
      testAudioRef.current = null;
    };
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError("");

    const trimmedTitle = title.trim();
    if (!trimmedTitle) {
      setFormError("Vui lòng nhập tên bài hát");
      return;
    }

    const trimmedUrl = audioUrl.trim();
    if (!trimmedUrl) {
      setFormError("Vui lòng nhập link âm thanh");
      return;
    }

    if (!/^https:\/\//i.test(trimmedUrl)) {
      setFormError("Link âm thanh phải bắt đầu bằng https://");
      return;
    }

    const finalCategory = category === "Khác" && customCategory.trim() ? customCategory.trim() : category;

    setSubmitting(true);

    try {
      const payload = {
        title: trimmedTitle,
        artist: artist.trim(),
        category: finalCategory,
        audioUrl: trimmedUrl,
        durationLabel: durationLabel.trim(),
        sortOrder: Number(sortOrder) || 0,
        isActive,
      };

      const url = initialTrack
        ? `/api/admin/music/${initialTrack.id}`
        : "/api/admin/music";

      const method = initialTrack ? "PATCH" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();

      if (!res.ok || !data.ok) {
        setFormError(data.message || "Không thể lưu bài hát");
        setSubmitting(false);
        return;
      }

      stopTestAudio();
      onSaved();
      onClose();
    } catch {
      setFormError("Lỗi kết nối. Vui lòng thử lại.");
    } finally {
      setSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm animate-fade-in overflow-y-auto">
      <div className="w-full max-w-lg rounded-2xl border bg-card p-6 shadow-xl my-8">
        {/* Header */}
        <div className="mb-5 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Music className="h-5 w-5 text-primary" />
            <h2 className="text-lg font-bold text-foreground">
              {initialTrack ? "Sửa bài hát" : "Thêm bài hát mới"}
            </h2>
          </div>
          <button
            onClick={handleClose}
            aria-label="Đóng form"
            className="rounded-lg p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Error message */}
        {formError && (
          <div className="mb-4 flex items-center gap-2 rounded-lg bg-destructive/10 p-3 text-xs font-medium text-destructive">
            <AlertCircle className="h-4 w-4 flex-shrink-0" />
            <span>{formError}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Title */}
          <div>
            <label className="mb-1 block text-xs font-semibold text-foreground">
              Tên bài hát <span className="text-destructive">*</span>
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="VD: Lofi Chill Study Beats"
              maxLength={150}
              required
              className="w-full rounded-lg border bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-primary focus:ring-1 focus:ring-primary"
            />
          </div>

          {/* Artist */}
          <div>
            <label className="mb-1 block text-xs font-semibold text-foreground">
              Tác giả / Ca sĩ
            </label>
            <input
              type="text"
              value={artist}
              onChange={(e) => setArtist(e.target.value)}
              placeholder="VD: ChilledCow / Chillhop Music"
              maxLength={150}
              className="w-full rounded-lg border bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-primary focus:ring-1 focus:ring-primary"
            />
          </div>

          {/* Category */}
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs font-semibold text-foreground">
                Thể loại <span className="text-destructive">*</span>
              </label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full rounded-lg border bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-primary focus:ring-1 focus:ring-primary"
              >
                {MUSIC_CATEGORIES.map((cat) => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
              </select>
            </div>

            {category === "Khác" && (
              <div>
                <label className="mb-1 block text-xs font-semibold text-foreground">
                  Nhập thể loại khác
                </label>
                <input
                  type="text"
                  value={customCategory}
                  onChange={(e) => setCustomCategory(e.target.value)}
                  placeholder="VD: Jazz, Acoustic..."
                  maxLength={50}
                  className="w-full rounded-lg border bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-primary focus:ring-1 focus:ring-primary"
                />
              </div>
            )}
          </div>

          {/* Audio URL & Test Button */}
          <div>
            <label className="mb-1 block text-xs font-semibold text-foreground">
              Link âm thanh (HTTPS) <span className="text-destructive">*</span>
            </label>
            <div className="flex gap-2">
              <input
                type="url"
                value={audioUrl}
                onChange={(e) => {
                  setAudioUrl(e.target.value);
                  stopTestAudio();
                }}
                placeholder="https://cdn.example.com/track.mp3"
                required
                className="flex-1 rounded-lg border bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-primary focus:ring-1 focus:ring-primary"
              />
              <button
                type="button"
                onClick={handleTestAudio}
                disabled={testing || !audioUrl.trim()}
                className="flex items-center gap-1.5 rounded-lg border bg-accent px-3 py-2 text-xs font-medium text-accent-foreground hover:bg-accent/80 transition-colors disabled:opacity-50"
              >
                {testing ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : testState === "playing" ? (
                  <Pause className="h-3.5 w-3.5 text-primary" />
                ) : (
                  <Play className="h-3.5 w-3.5 text-primary" />
                )}
                <span>{testState === "playing" ? "Dừng" : "Nghe thử"}</span>
              </button>
            </div>

            {/* Test result message */}
            {testMessage && (
              <div
                className={`mt-1.5 flex items-center gap-1.5 text-xs ${
                  testState === "error"
                    ? "text-destructive"
                    : testState === "success" || testState === "playing"
                    ? "text-emerald-600 dark:text-emerald-400"
                    : "text-muted-foreground"
                }`}
              >
                {testState === "error" && <AlertCircle className="h-3.5 w-3.5" />}
                {(testState === "success" || testState === "playing") && (
                  <CheckCircle2 className="h-3.5 w-3.5" />
                )}
                <span>{testMessage}</span>
              </div>
            )}
            <p className="mt-1 text-[11px] text-muted-foreground">
              Chấp nhận link HTTPS trực tiếp từ Cloudinary, Catbox, Google Drive direct, CDN...
            </p>
          </div>

          {/* Duration Label & Sort Order */}
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs font-semibold text-foreground">
                Thời lượng hiển thị
              </label>
              <input
                type="text"
                value={durationLabel}
                onChange={(e) => setDurationLabel(e.target.value)}
                placeholder="VD: 30 phút, 03:45"
                className="w-full rounded-lg border bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-primary focus:ring-1 focus:ring-primary"
              />
            </div>

            <div>
              <label className="mb-1 block text-xs font-semibold text-foreground">
                Thứ tự ưu tiên (Sort Order)
              </label>
              <input
                type="number"
                min={0}
                value={sortOrder}
                onChange={(e) => setSortOrder(parseInt(e.target.value, 10) || 0)}
                className="w-full rounded-lg border bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-primary focus:ring-1 focus:ring-primary"
              />
            </div>
          </div>

          {/* Status Toggle */}
          <div className="flex items-center gap-2 pt-1">
            <input
              type="checkbox"
              id="isActiveToggle"
              checked={isActive}
              onChange={(e) => setIsActive(e.target.checked)}
              className="h-4 w-4 rounded border-border text-primary focus:ring-primary"
            />
            <label htmlFor="isActiveToggle" className="text-xs font-medium text-foreground cursor-pointer">
              Hiển thị cho học viên (Is Active)
            </label>
          </div>

          {/* Actions */}
          <div className="flex items-center justify-end gap-2 pt-3 border-t">
            <button
              type="button"
              onClick={handleClose}
              className="rounded-lg border px-4 py-2 text-xs font-medium text-foreground hover:bg-accent transition-colors"
            >
              Hủy
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-xs font-medium text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50"
            >
              {submitting ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  <span>Đang lưu...</span>
                </>
              ) : (
                <span>Lưu bài hát</span>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
