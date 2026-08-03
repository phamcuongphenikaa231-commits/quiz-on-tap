"use client";

import { MonitorSmartphone } from "lucide-react";

const SUPPORT_URL =
  process.env.NEXT_PUBLIC_SUPPORT_URL ||
  "https://www.facebook.com/?locale=vi_VN";

export function DeviceLimitScreen() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="mx-auto max-w-md animate-fade-in text-center">
        <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-destructive/10">
          <MonitorSmartphone className="h-10 w-10 text-destructive" />
        </div>
        <h1 className="mb-3 text-2xl font-bold text-foreground">
          Đã đạt giới hạn thiết bị
        </h1>
        <p className="mb-8 text-muted-foreground">
          Tài khoản đã đăng nhập đủ 2 thiết bị. Vui lòng liên hệ hỗ trợ để
          reset thiết bị.
        </p>
        <a
          href={SUPPORT_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center justify-center rounded-lg bg-primary px-6 py-3 text-sm font-medium text-primary-foreground shadow transition-colors hover:bg-primary/90"
        >
          Liên hệ hỗ trợ qua Facebook
        </a>
      </div>
    </div>
  );
}
