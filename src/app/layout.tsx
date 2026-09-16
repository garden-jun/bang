import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "SKALA BANG!",
  description: "SKALA BANG!",
  openGraph: {
    title: "SKALA BANG!",
    description: "SKALA BANG!",
    siteName: "SKALA BANG!",
    type: "website",
  },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="ko" className="h-full antialiased">
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
