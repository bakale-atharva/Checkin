"use client";

import { Show, SignInButton, SignUpButton, UserButton } from "@clerk/nextjs";
import { Heart, House, Luggage, Search } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { cn } from "@/lib/utils";

const navLink =
  "inline-flex min-h-10 items-center gap-2 rounded-[0.7rem] px-3 text-sm font-semibold text-checkin-ink transition-colors hover:bg-checkin-mist/60 focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-checkin-signal/35";

export function SiteHeader() {
  const pathname = usePathname();
  const hosting = pathname.startsWith("/hosting");
  const current = (prefix: string) =>
    pathname === prefix || pathname.startsWith(`${prefix}/`)
      ? "page"
      : undefined;

  return (
    <header className="sticky top-0 z-50 border-b border-checkin-line bg-checkin-canvas/90 backdrop-blur-xl">
      <nav
        aria-label="Main"
        className="mx-auto flex h-16 w-full max-w-[90rem] items-center justify-between gap-3 px-4 sm:px-6 lg:px-8"
      >
        <Link
          href="/"
          className="text-xl font-bold tracking-[-0.06em] text-checkin-ink"
        >
          Checkin
          {hosting ? (
            <span className="ml-2 align-middle text-xs font-semibold tracking-normal text-checkin-signal">
              Hosting
            </span>
          ) : null}
        </Link>
        <div className="flex items-center gap-1">
          {hosting ? (
            <Link href="/" className={navLink}>
              <Search aria-hidden className="size-4" />
              <span className="max-sm:sr-only">Switch to traveling</span>
            </Link>
          ) : (
            <Link
              href="/hosting"
              aria-current={current("/hosting")}
              className={navLink}
            >
              <House aria-hidden className="size-4" />
              <span className="max-sm:sr-only">Switch to hosting</span>
            </Link>
          )}
          <Show when="signed-in">
            <Link
              href="/trips"
              aria-current={current("/trips")}
              className={cn(navLink, current("/trips") && "bg-checkin-mist/60")}
            >
              <Luggage aria-hidden className="size-4" />
              <span className="max-sm:sr-only">Trips</span>
            </Link>
            <Link
              href="/wishlists"
              aria-current={current("/wishlists")}
              className={cn(
                navLink,
                current("/wishlists") && "bg-checkin-mist/60",
              )}
            >
              <Heart aria-hidden className="size-4" />
              <span className="max-sm:sr-only">Wishlists</span>
            </Link>
            <span className="ml-1">
              <UserButton />
            </span>
          </Show>
          <Show when="signed-out">
            <SignInButton mode="modal">
              <button className={navLink}>Sign in</button>
            </SignInButton>
            <SignUpButton mode="modal">
              <button className="h-10 rounded-[0.7rem] bg-checkin-ink px-4 text-sm font-semibold text-checkin-canvas transition-colors hover:bg-checkin-ink/90 focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-checkin-signal/35 max-sm:hidden">
                Sign up
              </button>
            </SignUpButton>
          </Show>
        </div>
      </nav>
    </header>
  );
}
