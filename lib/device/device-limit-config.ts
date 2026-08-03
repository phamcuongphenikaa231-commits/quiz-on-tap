import "server-only";

/**
 * Trả true nếu giới hạn thiết bị bị tắt cho môi trường dev.
 *
 * Điều kiện: NODE_ENV !== "production" VÀ DISABLE_DEVICE_LIMIT === "true"
 * → Kể cả khi Vercel bị đặt nhầm DISABLE_DEVICE_LIMIT=true,
 *   production KHÔNG bao giờ bypass vì NODE_ENV là "production".
 *
 * KHÔNG sử dụng NEXT_PUBLIC_ — helper này chỉ chạy phía server.
 */
export function isDeviceLimitBypassed(): boolean {
  return (
    process.env.NODE_ENV !== "production" &&
    process.env.DISABLE_DEVICE_LIMIT === "true"
  );
}
