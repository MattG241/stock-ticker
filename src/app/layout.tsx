import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "The Drink Exchange",
  description: "Trade Drinks. Not Stocks.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en-AU" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500;600;700&family=Bebas+Neue&family=Playfair+Display:ital,wght@0,400;0,500;0,600;0,700;1,400&display=swap"
        />
      </head>
      <body className="min-h-screen bg-bg font-sans text-ink antialiased">{children}</body>
    </html>
  );
}
