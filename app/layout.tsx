import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "文章后台",
  robots: { index: false, follow: false },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  );
}
