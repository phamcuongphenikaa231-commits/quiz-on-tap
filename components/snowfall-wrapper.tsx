"use client";

import dynamic from "next/dynamic";

// Wrapper client component để dùng ssr:false trong Server Component pages
const SnowfallEffect = dynamic(
  () => import("@/components/snowfall-effect"),
  { ssr: false }
);

export function SnowfallWrapper() {
  return <SnowfallEffect />;
}
