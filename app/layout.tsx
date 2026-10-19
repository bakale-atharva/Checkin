import { ClerkProvider } from "@clerk/nextjs";
import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import { Geist, Geist_Mono } from "next/font/google";
import { SiteHeader } from "@/components/site-header";
import { ConvexClientProvider } from "./convex-client-provider";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Checkin — stays, clearly",
  description: "Search, compare, and reserve stays with confidence.",
};

export const viewport: Viewport = {
  // Matches --checkin-canvas.
  themeColor: "#f7f4ee",
  colorScheme: "light",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <a
          href="#content"
          className="sr-only z-[60] rounded-[0.7rem] bg-checkin-ink px-4 py-3 text-sm font-semibold text-checkin-canvas focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:outline-none focus:ring-3 focus:ring-checkin-signal/45"
        >
          Skip to content
        </a>
        <ClerkProvider>
          <ConvexClientProvider>
            <SiteHeader />
            {/* Skip-link target; pages render their own <main> inside. */}
            <div
              id="content"
              tabIndex={-1}
              className="flex flex-1 flex-col focus:outline-none"
            >
              {children}
            </div>
          </ConvexClientProvider>
        </ClerkProvider>
      </body>
    </html>
  );
}
