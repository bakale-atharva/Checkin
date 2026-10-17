import {
  ClerkProvider,
  Show,
  SignInButton,
  SignUpButton,
  UserButton,
} from "@clerk/nextjs";
import type { Metadata } from "next";
import type { ReactNode } from "react";
import Link from "next/link";
import { Geist, Geist_Mono } from "next/font/google";
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

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <ClerkProvider>
          <ConvexClientProvider>
            <header className="sticky top-0 z-50 border-b border-checkin-line bg-checkin-canvas/90 backdrop-blur-xl">
            <nav className="mx-auto flex h-16 w-full max-w-[90rem] items-center justify-between px-4 sm:px-6 lg:px-8">
              <Link
                href="/"
                className="text-xl font-bold tracking-[-0.06em] text-checkin-ink"
              >
                Checkin
              </Link>
              <div className="flex items-center gap-2">
                <Show when="signed-out">
                  <SignInButton mode="modal">
                    <button className="h-10 rounded-[0.7rem] px-4 text-sm font-semibold text-checkin-ink transition-colors hover:bg-checkin-mist/60">
                      Sign in
                    </button>
                  </SignInButton>
                  <SignUpButton mode="modal">
                    <button className="h-10 rounded-[0.7rem] bg-checkin-ink px-4 text-sm font-semibold text-checkin-canvas transition-colors hover:bg-checkin-ink/90">
                      Sign up
                    </button>
                  </SignUpButton>
                </Show>
                <Show when="signed-in">
                  <UserButton />
                </Show>
              </div>
            </nav>
          </header>
            {children}
          </ConvexClientProvider>
        </ClerkProvider>
      </body>
    </html>
  );
}
