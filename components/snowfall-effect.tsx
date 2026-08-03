"use client";

import { memo, useEffect, useMemo, useState } from "react";

// Số lượng bông tuyết tuỳ theo màn hình
const DESKTOP_COUNT = 40;
const MOBILE_COUNT = 20;
const MOBILE_BREAKPOINT = 768;

interface Snowflake {
  id: number;
  left: number;        // % from left
  size: number;        // px
  opacity: number;
  duration: number;    // seconds
  delay: number;       // seconds
  drift: string;       // CSS custom property value (px)
}

function generateFlakes(count: number): Snowflake[] {
  return Array.from({ length: count }, (_, i) => ({
    id: i,
    left: Math.random() * 100,
    size: 3 + Math.random() * 5,                   // 3–8 px
    opacity: 0.25 + Math.random() * 0.5,           // 0.25–0.75
    duration: 8 + Math.random() * 12,              // 8–20 s
    delay: -(Math.random() * 20),                  // stagger start (negative = pre-run)
    drift: `${Math.round((Math.random() - 0.5) * 80)}px`,  // ±40 px horizontal drift
  }));
}

function SnowfallEffect() {
  const [enabled, setEnabled] = useState<boolean | null>(null);
  const [isMobile, setIsMobile] = useState(false);

  // Read localStorage only after mount (avoids hydration mismatch)
  useEffect(() => {
    const stored = localStorage.getItem("snowfall_enabled");
    setEnabled(stored === "false" ? false : true);

    const mq = window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT - 1}px)`);
    setIsMobile(mq.matches);
    const handler = (e: MediaQueryListEvent) => setIsMobile(e.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);

  const handleToggle = () => {
    setEnabled((prev) => {
      const next = !prev;
      localStorage.setItem("snowfall_enabled", String(next));
      return next;
    });
  };

  // Stable flake arrays (not re-generated on toggle)
  const desktopFlakes = useMemo(() => generateFlakes(DESKTOP_COUNT), []);
  const mobileFlakes = useMemo(() => generateFlakes(MOBILE_COUNT), []);

  // Don't render anything until we know the preference (avoid flash)
  if (enabled === null) return null;

  const flakes = isMobile ? mobileFlakes : desktopFlakes;

  return (
    <>
      {/* Toggle button */}
      <button
        onClick={handleToggle}
        aria-label={enabled ? "Tắt hiệu ứng tuyết rơi" : "Bật hiệu ứng tuyết rơi"}
        title={enabled ? "Tắt tuyết" : "Bật tuyết"}
        className="snowfall-toggle"
      >
        {enabled ? "❄️" : "🌤️"}
      </button>

      {/* Snowflake layer - aria-hidden, pointer-events: none */}
      {enabled && (
        <div
          aria-hidden="true"
          className="snowfall-effect"
        >
          {flakes.map((flake) => (
            <span
              key={flake.id}
              className="snowflake"
              style={{
                left: `${flake.left}%`,
                width: `${flake.size}px`,
                height: `${flake.size}px`,
                opacity: flake.opacity,
                animationDuration: `${flake.duration}s`,
                animationDelay: `${flake.delay}s`,
                "--drift": flake.drift,
              } as React.CSSProperties}
            />
          ))}
        </div>
      )}
    </>
  );
}

// Memo to prevent re-renders from parent state changes
export default memo(SnowfallEffect);
