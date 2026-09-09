import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Clear Send | Clear Technology Solutions",
  description: "Temporary file handoffs from Clear Technology Solutions.",
  other: {
    "codex-preview": "development",
  },
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased">{children}</body>
    </html>
  );
}
