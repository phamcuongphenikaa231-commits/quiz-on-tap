"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { useMusicContext } from "./music-context";
import type { CornerPosition } from "@/lib/music/types";
import { STORAGE_KEYS } from "@/lib/music/types";
import dynamic from "next/dynamic";
import {
  GripVertical,
  Maximize2,
  StopCircle,
  MapPin,
  ChevronDown,
} from "lucide-react";

// Lazy load heavy players
const YouTubePlayer = dynamic(
  () => import("./youtube-player").then((m) => ({ default: m.YouTubePlayer })),
  { ssr: false }
);
const SoundCloudPlayer = dynamic(
  () => import("./soundcloud-player").then((m) => ({ default: m.SoundCloudPlayer })),
  { ssr: false }
);

const CORNER_LABELS: Record<CornerPosition, string> = {
  "top-left": "Góc trên trái",
  "top-right": "Góc trên phải",
  "bottom-left": "Góc dưới trái",
  "bottom-right": "Góc dưới phải",
};

const CORNER_ORDER: CornerPosition[] = [
  "top-left",
  "top-right",
  "bottom-left",
  "bottom-right",
];

function isMobileViewport(): boolean {
  if (typeof window === "undefined") return false;
  return window.innerWidth < 640;
}

function getSavedCorner(): CornerPosition {
  if (typeof window === "undefined") return "bottom-left";
  const mobile = isMobileViewport();
  const key = mobile ? STORAGE_KEYS.MOBILE_CORNER : STORAGE_KEYS.DESKTOP_CORNER;
  const saved = localStorage.getItem(key) as CornerPosition | null;
  if (saved && CORNER_ORDER.includes(saved)) {
    return saved;
  }
  // Default: mobile -> top-left, desktop -> bottom-left
  return mobile ? "top-left" : "bottom-left";
}

function saveCorner(corner: CornerPosition) {
  try {
    const mobile = isMobileViewport();
    const key = mobile ? STORAGE_KEYS.MOBILE_CORNER : STORAGE_KEYS.DESKTOP_CORNER;
    localStorage.setItem(key, corner);
  } catch {
    // ignore
  }
}

interface Rect {
  left: number;
  top: number;
  right: number;
  bottom: number;
  width: number;
  height: number;
}

function checkOverlap(r1: Rect, r2: Rect, margin = 12): boolean {
  return !(
    r1.right + margin <= r2.left ||
    r1.left >= r2.right + margin ||
    r1.bottom + margin <= r2.top ||
    r1.top >= r2.bottom + margin
  );
}

function computeCornerCoordinates(
  corner: CornerPosition,
  playerWidth: number,
  playerHeight: number
): { x: number; y: number } {
  const vw = window.innerWidth;
  const vh = window.innerHeight;

  const mobile = isMobileViewport();
  const margin = mobile ? 12 : 16;

  let x = margin;
  let y = margin;

  if (corner === "top-right" || corner === "bottom-right") {
    x = vw - playerWidth - margin;
  }
  if (corner === "bottom-left" || corner === "bottom-right") {
    y = vh - playerHeight - margin;
  }

  // Bound within screen
  x = Math.max(margin, Math.min(vw - playerWidth - margin, x));
  y = Math.max(margin, Math.min(vh - playerHeight - margin, y));

  return { x, y };
}

export function DraggableMiniPlayer() {
  const {
    currentSource,
    playerState,
    stopMusic,
    setPanelOpen,
    setPlayerState,
    setErrorMessage,
  } = useMusicContext();

  const [corner, setCorner] = useState<CornerPosition>("bottom-left");
  const [position, setPosition] = useState<{ x: number; y: number }>({ x: 16, y: 16 });
  const [isDragging, setIsDragging] = useState(false);
  const [showCornerMenu, setShowCornerMenu] = useState(false);

  const containerRef = useRef<HTMLDivElement>(null);
  const dragHandleRef = useRef<HTMLDivElement>(null);
  const animFrameRef = useRef<number | null>(null);

  // Refs for tracking position without re-rendering during drag
  const currentPosRef = useRef<{ x: number; y: number }>({ x: 16, y: 16 });
  const dragStartRef = useRef<{ pointerX: number; pointerY: number; posX: number; posY: number }>({
    pointerX: 0,
    pointerY: 0,
    posX: 0,
    posY: 0,
  });

  // Hydrate corner preference after mount
  useEffect(() => {
    const saved = getSavedCorner();
    setCorner(saved);
  }, []);

  // Update coordinates whenever corner changes or window resizes
  const updatePositionForCorner = useCallback((targetCorner: CornerPosition) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const width = rect.width || 260;
    const height = rect.height || 200;

    let coords = computeCornerCoordinates(targetCorner, width, height);

    // Check obstacle collisions
    const obstacles = Array.from(
      document.querySelectorAll<HTMLElement>("[data-floating-obstacle]")
    ).map((el) => el.getBoundingClientRect());

    const playerRect: Rect = {
      left: coords.x,
      top: coords.y,
      right: coords.x + width,
      bottom: coords.y + height,
      width,
      height,
    };

    const hasCollision = obstacles.some((obs) => checkOverlap(playerRect, obs));

    // If colliding, try fallback corners
    if (hasCollision) {
      for (const fallback of CORNER_ORDER) {
        if (fallback === targetCorner) continue;
        const altCoords = computeCornerCoordinates(fallback, width, height);
        const altRect: Rect = {
          left: altCoords.x,
          top: altCoords.y,
          right: altCoords.x + width,
          bottom: altCoords.y + height,
          width,
          height,
        };
        if (!obstacles.some((obs) => checkOverlap(altRect, obs))) {
          coords = altCoords;
          targetCorner = fallback;
          break;
        }
      }
    }

    currentPosRef.current = coords;
    setPosition(coords);
    setCorner(targetCorner);
    saveCorner(targetCorner);
  }, []);

  // Recalculate position on window resize / orientation change
  useEffect(() => {
    if (!currentSource) return;

    const handleResize = () => {
      updatePositionForCorner(corner);
    };

    window.addEventListener("resize", handleResize);
    window.addEventListener("orientationchange", handleResize);
    // Initial calculation
    const timer = setTimeout(() => handleResize(), 100);

    return () => {
      window.removeEventListener("resize", handleResize);
      window.removeEventListener("orientationchange", handleResize);
      clearTimeout(timer);
    };
  }, [currentSource, corner, updatePositionForCorner]);

  // Pointer Drag Handlers
  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    // Only drag on handle bar (not on buttons inside handle bar)
    const target = e.target as HTMLElement;
    if (target.closest("button") || target.closest("select")) return;

    if (!containerRef.current) return;

    e.preventDefault();
    (e.target as HTMLElement).setPointerCapture(e.pointerId);

    setIsDragging(true);
    dragStartRef.current = {
      pointerX: e.clientX,
      pointerY: e.clientY,
      posX: currentPosRef.current.x,
      posY: currentPosRef.current.y,
    };
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isDragging) return;

    const dx = e.clientX - dragStartRef.current.pointerX;
    const dy = e.clientY - dragStartRef.current.pointerY;

    const nextX = dragStartRef.current.posX + dx;
    const nextY = dragStartRef.current.posY + dy;

    currentPosRef.current = { x: nextX, y: nextY };

    if (animFrameRef.current !== null) {
      cancelAnimationFrame(animFrameRef.current);
    }

    animFrameRef.current = requestAnimationFrame(() => {
      if (containerRef.current) {
        containerRef.current.style.transform = `translate3d(${nextX}px, ${nextY}px, 0)`;
      }
    });
  };

  const handlePointerUpOrCancel = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isDragging) return;
    setIsDragging(false);

    try {
      (e.target as HTMLElement).releasePointerCapture(e.pointerId);
    } catch {
      // ignore
    }

    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const vw = window.innerWidth;
    const vh = window.innerHeight;

    const midX = rect.left + rect.width / 2;
    const midY = rect.top + rect.height / 2;

    // Find nearest corner
    let nearest: CornerPosition = "bottom-left";
    if (midY < vh / 2) {
      nearest = midX < vw / 2 ? "top-left" : "top-right";
    } else {
      nearest = midX < vw / 2 ? "bottom-left" : "bottom-right";
    }

    updatePositionForCorner(nearest);
  };

  // Keyboard navigation support for accessibility
  const handleKeyDown = (e: React.KeyboardEvent) => {
    const step = e.shiftKey ? 40 : 10;
    let { x, y } = currentPosRef.current;
    let handled = false;

    if (e.key === "ArrowLeft") {
      x -= step;
      handled = true;
    } else if (e.key === "ArrowRight") {
      x += step;
      handled = true;
    } else if (e.key === "ArrowUp") {
      y -= step;
      handled = true;
    } else if (e.key === "ArrowDown") {
      y += step;
      handled = true;
    }

    if (handled) {
      e.preventDefault();
      currentPosRef.current = { x, y };
      setPosition({ x, y });
    }
  };

  const handlePlayerStateChange = useCallback(
    (state: "playing" | "paused" | "ended" | "buffering") => {
      if (state === "playing") setPlayerState("playing");
      else if (state === "paused") setPlayerState("paused");
      else if (state === "ended") setPlayerState("idle");
      else if (state === "buffering") setPlayerState("loading");
    },
    [setPlayerState]
  );

  const handlePlayerReady = useCallback(() => {
    setPlayerState("playing");
  }, [setPlayerState]);

  const handlePlayerError = useCallback(
    (msg: string) => {
      setPlayerState("error");
      setErrorMessage(msg);
    },
    [setPlayerState, setErrorMessage]
  );

  if (!currentSource) return null;

  return (
    <div
      ref={containerRef}
      role="region"
      aria-label="Trình phát nhạc thu nhỏ"
      tabIndex={0}
      onKeyDown={handleKeyDown}
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        transform: `translate3d(${position.x}px, ${position.y}px, 0)`,
        zIndex: 150,
      }}
      className={`draggable-mini-player ${isDragging ? "draggable-mini-player--dragging" : ""}`}
    >
      {/* Drag Handle Bar */}
      <div
        ref={dragHandleRef}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUpOrCancel}
        onPointerCancel={handlePointerUpOrCancel}
        title="Kéo để di chuyển trình phát"
        role="button"
        tabIndex={0}
        aria-label="Di chuyển trình phát nhạc"
        className="drag-handle"
      >
        <div className="drag-handle__info">
          <GripVertical className="drag-handle__grip-icon" aria-hidden="true" />
          <span className="drag-handle__title">
            {playerState === "playing" ? "Đang nghe nhạc" : "Nhạc"}
          </span>
        </div>

        <div className="drag-handle__actions">
          {/* Quick Corner Switch Dropdown */}
          <div className="relative">
            <button
              onClick={() => setShowCornerMenu(!showCornerMenu)}
              aria-label="Đổi vị trí trình phát"
              title="Vị trí trình phát"
              className="drag-handle__btn"
            >
              <MapPin className="h-3.5 w-3.5" />
              <ChevronDown className="h-3 w-3" />
            </button>

            {showCornerMenu && (
              <div className="corner-menu">
                <p className="corner-menu__label">Vị trí trình phát</p>
                {CORNER_ORDER.map((c) => (
                  <button
                    key={c}
                    onClick={() => {
                      updatePositionForCorner(c);
                      setShowCornerMenu(false);
                    }}
                    className={`corner-menu__item ${corner === c ? "corner-menu__item--active" : ""}`}
                  >
                    {CORNER_LABELS[c]}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Expand Panel button */}
          <button
            onClick={() => setPanelOpen(true)}
            aria-label="Mở rộng trình phát nhạc"
            title="Mở rộng panel nhạc"
            className="drag-handle__btn"
          >
            <Maximize2 className="h-3.5 w-3.5" />
          </button>

          {/* Stop Music button */}
          <button
            onClick={stopMusic}
            aria-label="Dừng nhạc và đóng trình phát"
            title="Dừng nhạc"
            className="drag-handle__btn drag-handle__btn--danger"
          >
            <StopCircle className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {/* Persistent Player Content (Single IFrame Instance) */}
      <div className="draggable-mini-player__body">
        {currentSource.provider === "youtube" && (
          <YouTubePlayer
            source={currentSource as Extract<typeof currentSource, { provider: "youtube" }>}
            onStateChange={handlePlayerStateChange}
            onReady={handlePlayerReady}
            onError={handlePlayerError}
          />
        )}

        {currentSource.provider === "soundcloud" && (
          <SoundCloudPlayer
            url={(currentSource as Extract<typeof currentSource, { provider: "soundcloud" }>).url}
            onStateChange={handlePlayerStateChange}
            onReady={handlePlayerReady}
            onError={handlePlayerError}
          />
        )}
      </div>
    </div>
  );
}
