import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "BANG! 온라인",
  description: "친구들과 브라우저로 즐기는 BANG! 보드게임",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="ko" className="h-full antialiased">
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
