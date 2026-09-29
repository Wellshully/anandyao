import type { Metadata } from "next";
import type { CSSProperties } from "react";

import "./globals.css";

import ThemeBootScript from "@/features/appearance/components/ThemeBootScript";
const fontVariables = {
  "--font-sans":
    '-apple-system, BlinkMacSystemFont, "Segoe UI", "PingFang TC", "Noto Sans TC", "Microsoft JhengHei", sans-serif',

  "--font-serif": '"Noto Serif TC", "Songti TC", "PMingLiU", serif',
} as CSSProperties;

export const metadata: Metadata = {
  title: {
    default: "An & Yao",
    template: "%s · An & Yao",
  },

  description: "Our little place on the internet.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-Hant" style={fontVariables} suppressHydrationWarning>
      <body>
        <ThemeBootScript />{children}</body>
    </html>
  );
}
