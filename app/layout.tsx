import type { Metadata } from "next";
import "./globals.css";
import "./ai-coach.css";
import "./login/login.css";
import type { Viewport } from "next";

export const metadata: Metadata = {
  title: "OscarOS",
  manifest: "/manifest.webmanifest",
  appleWebApp: { capable: true, title: "OscarOS", statusBarStyle: "default" },
  description: "Din privata plats för uppgifter, tankar, vanor, mål och AI-stöd.",
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
  themeColor: "#0b0d15",
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
