import type { Metadata } from "next";
import "./globals.css";
import type { Viewport } from "next";

export const metadata: Metadata = {
  title: "Personal OS",
  manifest: "/manifest.webmanifest",
  appleWebApp: { capable: true, title: "Personal OS", statusBarStyle: "default" },
  description: "Din privata plats för uppgifter, tankar, vanor och mål. Allt sparas lokalt.",
  other: {
    "codex-preview": "development",
  },
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
    apple: "/apple-touch-icon.png",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#eeebf4",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="sv">
      <body className="antialiased">{children}</body>
    </html>
  );
}

