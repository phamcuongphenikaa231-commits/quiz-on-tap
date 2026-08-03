"use client";

/**
 * AccountSharingWarning
 *
 * Hiển thị hộp cảnh báo chia sẻ tài khoản khi học viên vào khu vực học.
 *
 * Quy tắc:
 * - isOpen khởi đầu là true → hiện ngay khi component mount.
 * - Bấm X hoặc "Tôi đã hiểu" → setIsOpen(false) → ẩn.
 * - KHÔNG lưu trạng thái vào localStorage / sessionStorage / cookie / database.
 * - Refresh trang → component unmount & mount lại → isOpen = true → hiện lại.
 * - Chuyển trang nội bộ Next.js trong cùng layout → state giữ nguyên → không hiện lại.
 * - Chỉ render backdrop + hộp sau khi mounted để tránh hydration warning.
 */

import { useCallback, useEffect, useId, useRef, useState } from "react";

export function AccountSharingWarning() {
  const [mounted, setMounted] = useState(false);
  const [isOpen, setIsOpen] = useState(true);
  // For exit animation
  const [isClosing, setIsClosing] = useState(false);

  const dialogRef = useRef<HTMLDivElement>(null);
  const confirmBtnRef = useRef<HTMLButtonElement>(null);
  // Element to restore focus after close
  const previousFocusRef = useRef<HTMLElement | null>(null);

  const titleId = useId();
  const descId = useId();

  // Mount guard — prevents SSR hydration mismatch
  useEffect(() => {
    setMounted(true);
  }, []);

  const handleClose = useCallback(() => {
    setIsClosing(true);
    // Wait for exit animation before unmounting content
    setTimeout(() => {
      setIsOpen(false);
      setIsClosing(false);
      // Restore focus
      previousFocusRef.current?.focus();
    }, 220);
  }, []);

  // Focus trap & restore
  useEffect(() => {
    if (!mounted || !isOpen) return;

    // Save currently focused element
    previousFocusRef.current = document.activeElement as HTMLElement;

    // Focus the confirm button on open
    const raf = requestAnimationFrame(() => {
      confirmBtnRef.current?.focus();
    });

    // Focus trap handler
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        handleClose();
        return;
      }

      if (e.key !== "Tab") return;

      const dialog = dialogRef.current;
      if (!dialog) return;

      const focusable = dialog.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), textarea, input, select, [tabindex]:not([tabindex="-1"])'
      );
      const first = focusable[0];
      const last = focusable[focusable.length - 1];

      if (e.shiftKey) {
        if (document.activeElement === first) {
          e.preventDefault();
          last?.focus();
        }
      } else {
        if (document.activeElement === last) {
          e.preventDefault();
          first?.focus();
        }
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => {
      cancelAnimationFrame(raf);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [mounted, isOpen, handleClose]);

  // Nothing rendered on server or before mount
  if (!mounted) return null;
  if (!isOpen && !isClosing) return null;

  const entering = isOpen && !isClosing;

  return (
    <>
      {/* ── Backdrop ── */}
      <div
        aria-hidden="true"
        className="asw-backdrop"
        style={{ animationName: entering ? "asw-fade-in" : "asw-fade-out" }}
      />

      {/* ── Dialog ── */}
      <div
        ref={dialogRef}
        role="alertdialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descId}
        className="asw-positioner"
      >
        <div
          className="asw-box"
          style={{ animationName: entering ? "asw-in" : "asw-out" }}
        >
          {/* ── Header ── */}
          <div className="asw-header">
            <div className="asw-title-row">
              <span className="asw-icon" aria-hidden="true">⚠</span>
              <h2 id={titleId} className="asw-title">
                CẢNH BÁO CHIA SẺ TÀI KHOẢN
              </h2>
            </div>
            <button
              type="button"
              onClick={handleClose}
              className="asw-close-btn"
              aria-label="Đóng cảnh báo chia sẻ tài khoản"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </div>

          {/* ── Divider ── */}
          <div className="asw-divider" aria-hidden="true" />

          {/* ── Body ── */}
          <div id={descId} className="asw-body">
            <p className="asw-paragraph">
              Nghiêm cấm hành vi chia sẻ tài khoản cho người khác.
            </p>
            <p className="asw-paragraph">
              Hệ thống sẽ ghi nhận và kiểm tra các thiết bị đăng nhập. Nếu
              phát hiện nhiều thiết bị đăng nhập bất thường, tài khoản của bạn
              sẽ bị khóa.
            </p>
            <p className="asw-paragraph">
              Hãy tôn trọng đồng tiền và công sức của bản thân bằng cách không
              chia sẻ tài khoản.
            </p>
          </div>

          {/* ── Emphasis row ── */}
          <div className="asw-emphasis">
            <span className="asw-emphasis-icon" aria-hidden="true">🔒</span>
            <span>Mỗi tài khoản chỉ dành cho một người sử dụng.</span>
          </div>

          {/* ── Footer ── */}
          <div className="asw-footer">
            <button
              ref={confirmBtnRef}
              type="button"
              onClick={handleClose}
              className="asw-confirm-btn"
              aria-label="Tôi đã hiểu cảnh báo chia sẻ tài khoản"
            >
              Tôi đã hiểu
            </button>
          </div>
        </div>
      </div>

      {/* ── Scoped styles ── */}
      <style>{`
        /* === Keyframes === */
        @keyframes asw-fade-in  { from { opacity: 0; } to { opacity: 1; } }
        @keyframes asw-fade-out { from { opacity: 1; } to { opacity: 0; } }

        @keyframes asw-in {
          from { opacity: 0; transform: scale(0.97) translateY(6px); }
          to   { opacity: 1; transform: scale(1)    translateY(0);   }
        }
        @keyframes asw-out {
          from { opacity: 1; transform: scale(1)    translateY(0);   }
          to   { opacity: 0; transform: scale(0.97) translateY(6px); }
        }

        /* === Backdrop === */
        .asw-backdrop {
          position: fixed;
          inset: 0;
          background: rgba(15, 23, 42, 0.35);
          z-index: 9998;
          backdrop-filter: blur(2px);
          -webkit-backdrop-filter: blur(2px);
          animation-duration: 200ms;
          animation-fill-mode: both;
          animation-timing-function: ease;
        }

        /* === Positioner === */
        .asw-positioner {
          position: fixed;
          inset: 0;
          z-index: 9999;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 16px;
          padding-top: calc(16px + env(safe-area-inset-top, 0px));
          padding-bottom: calc(16px + env(safe-area-inset-bottom, 0px));
          pointer-events: none;   /* let clicks pass through to backdrop or dialog */
        }

        /* === Box === */
        .asw-box {
          pointer-events: auto;
          background: #ffffff;
          border: 1.5px solid #fca5a5;         /* red-300 */
          border-radius: 18px;
          box-shadow:
            0 4px 6px -1px rgba(0,0,0,0.07),
            0 10px 32px -4px rgba(239,68,68,0.12),
            0 0 0 1px rgba(239,68,68,0.06);
          width: min(540px, calc(100vw - 32px));
          max-height: min(80dvh, calc(100dvh - 32px - env(safe-area-inset-top, 0px) - env(safe-area-inset-bottom, 0px)));
          overflow-y: auto;
          overflow-x: hidden;
          overscroll-behavior: contain;
          -webkit-overflow-scrolling: touch;
          animation-duration: 220ms;
          animation-fill-mode: both;
          animation-timing-function: cubic-bezier(0.34, 1.06, 0.64, 1);
          display: flex;
          flex-direction: column;
        }

        /* === Header === */
        .asw-header {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 12px;
          padding: 20px 20px 0;
        }

        .asw-title-row {
          display: flex;
          align-items: center;
          gap: 10px;
          flex: 1;
          min-width: 0;
        }

        .asw-icon {
          font-size: 1.4rem;
          line-height: 1;
          color: #dc2626;          /* red-600 */
          flex-shrink: 0;
          filter: drop-shadow(0 1px 2px rgba(220,38,38,0.3));
        }

        .asw-title {
          margin: 0;
          font-size: 0.9375rem;
          font-weight: 800;
          color: #b91c1c;          /* red-700 */
          letter-spacing: 0.03em;
          line-height: 1.3;
          text-transform: uppercase;
        }

        /* === Close button === */
        .asw-close-btn {
          flex-shrink: 0;
          display: flex;
          align-items: center;
          justify-content: center;
          width: 36px;
          height: 36px;
          min-width: 44px;
          min-height: 44px;
          border-radius: 9999px;
          border: 1px solid #fecaca;   /* red-200 */
          background: #fff5f5;
          color: #ef4444;              /* red-500 */
          cursor: pointer;
          transition: background 150ms ease, color 150ms ease, transform 150ms ease;
          margin-top: -4px;
          margin-right: -4px;
        }
        .asw-close-btn:hover {
          background: #fee2e2;
          color: #b91c1c;
          transform: scale(1.07);
        }
        .asw-close-btn:active {
          transform: scale(0.95);
        }
        .asw-close-btn:focus-visible {
          outline: 2px solid #ef4444;
          outline-offset: 2px;
        }

        /* === Divider === */
        .asw-divider {
          height: 1px;
          background: linear-gradient(90deg, transparent, #fecaca 30%, #fecaca 70%, transparent);
          margin: 14px 20px 0;
        }

        /* === Body === */
        .asw-body {
          padding: 14px 20px 0;
          display: flex;
          flex-direction: column;
          gap: 10px;
        }

        .asw-paragraph {
          margin: 0;
          font-size: 0.9rem;
          line-height: 1.65;
          color: #374151;            /* slate-700 / gray-700 */
        }

        /* === Emphasis === */
        .asw-emphasis {
          display: flex;
          align-items: center;
          gap: 8px;
          margin: 16px 20px 0;
          padding: 10px 14px;
          background: #fefce8;       /* yellow-50 */
          border: 1px solid #fde68a; /* yellow-200 */
          border-radius: 10px;
          font-size: 0.875rem;
          font-weight: 700;
          color: #92400e;            /* amber-800 */
          line-height: 1.4;
        }

        .asw-emphasis-icon {
          font-size: 1rem;
          flex-shrink: 0;
        }

        /* === Footer === */
        .asw-footer {
          padding: 16px 20px 20px;
          padding-bottom: max(20px, env(safe-area-inset-bottom, 20px));
        }

        /* === Confirm button (indigo – đồng bộ màu website) === */
        .asw-confirm-btn {
          width: 100%;
          height: 46px;
          min-height: 44px;
          border: none;
          border-radius: 10px;
          background: linear-gradient(135deg, #4f46e5 0%, #6366f1 100%);
          color: #ffffff;
          font-size: 0.9375rem;
          font-weight: 600;
          letter-spacing: 0.01em;
          cursor: pointer;
          transition: opacity 160ms ease, transform 160ms ease, box-shadow 160ms ease;
          box-shadow: 0 4px 14px rgba(79,70,229,0.30);
        }
        .asw-confirm-btn:hover {
          opacity: 0.92;
          transform: translateY(-1px);
          box-shadow: 0 6px 20px rgba(79,70,229,0.38);
        }
        .asw-confirm-btn:active {
          transform: translateY(0);
          opacity: 1;
        }
        .asw-confirm-btn:focus-visible {
          outline: 2px solid #6366f1;
          outline-offset: 2px;
        }

        /* === Reduce-motion override === */
        @media (prefers-reduced-motion: reduce) {
          .asw-backdrop,
          .asw-box {
            animation: none !important;
            opacity: 1 !important;
            transform: none !important;
          }
          .asw-close-btn,
          .asw-confirm-btn {
            transition: none !important;
          }
        }

        /* === Mobile fine-tuning (≤ 480px) === */
        @media (max-width: 480px) {
          .asw-header {
            padding: 16px 16px 0;
          }
          .asw-title {
            font-size: 0.8125rem;
          }
          .asw-divider {
            margin: 12px 16px 0;
          }
          .asw-body {
            padding: 12px 16px 0;
          }
          .asw-emphasis {
            margin: 14px 16px 0;
          }
          .asw-footer {
            padding: 14px 16px 16px;
            padding-bottom: max(16px, env(safe-area-inset-bottom, 16px));
          }
        }
      `}</style>
    </>
  );
}
