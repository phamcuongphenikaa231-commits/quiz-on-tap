"use client";

import { MessageCircle } from "lucide-react";

const SUPPORT_URL =
  process.env.NEXT_PUBLIC_SUPPORT_URL ||
  "https://www.facebook.com/?locale=vi_VN";

export function SupportButton() {
  return (
    <a
      href={SUPPORT_URL}
      target="_blank"
      rel="noopener noreferrer"
      className="fixed bottom-6 right-6 z-50 flex items-center gap-2 rounded-full bg-primary px-4 py-3 text-primary-foreground shadow-lg transition-all hover:scale-105 hover:shadow-xl active:scale-95 sm:px-5"
      aria-label="Liên hệ hỗ trợ"
    >
      <MessageCircle className="h-5 w-5" />
      <span className="hidden text-sm font-medium sm:inline">
        Liên hệ hỗ trợ
      </span>
    </a>
  );
}
