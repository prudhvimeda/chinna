import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "RJ — AI Voice Assistant",
  description: "A production-ready, fully open-source AI voice assistant. Offline capable, zero hallucination, professional and friendly.",
  keywords: ["AI", "voice assistant", "open source", "offline", "Jarvis"],
  authors: [{ name: "Prudhvi Narayana Meda" }],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500;600&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
