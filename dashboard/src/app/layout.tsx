import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Dream Memory — 记忆系统",
  description: "跨 AI 工具共享记忆中间件",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-CN" className="dark">
      <body className="antialiased bg-[--bg-primary] text-[--text-primary]">
        {children}
      </body>
    </html>
  );
}
