import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { SupportButton } from "@/components/support-button";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  display: "swap",
  subsets: ["latin", "vietnamese"],
});

const defaultUrl = process.env.VERCEL_URL
  ? `https://${process.env.VERCEL_URL}`
  : "http://localhost:3000";

export const metadata: Metadata = {
  metadataBase: new URL(defaultUrl),
  title: "Quiz Ôn Tập",
  description: "Hệ thống ôn tập trắc nghiệm trực tuyến",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="vi" suppressHydrationWarning>
      <body className={`${inter.className} antialiased`}>
        {children}
        <SupportButton />
      </body>
    </html>
  );
}
