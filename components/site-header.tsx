"use client";

import { Show, SignInButton, SignUpButton, UserButton } from "@clerk/nextjs";
import { useQuery } from "convex/react";
import {
  Bell,
  Heart,
  House,
  Luggage,
  MessageCircle,
  Search,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { useProfileReady } from "@/components/use-profile-ready";
import { api } from "@/convex/_generated/api";
import { badgeCount } from "@/lib/messaging/inbox-presentation";
import { cn } from "@/lib/utils";

const navLink =
  "inline-flex min-h-11 min-w-11 items-center justify-center gap-2 rounded-[0.7rem] px-3 text-sm font-semibold text-checkin-ink transition-colors hover:bg-checkin-mist/60 focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-checkin-signal/35";

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
          className="inline-flex min-h-11 items-center rounded-[0.7rem] text-xl font-bold tracking-[-0.06em] text-checkin-ink focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-checkin-signal/35"
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
              className={cn(
                navLink,
                "max-sm:hidden",
                current("/trips") && "bg-checkin-mist/60",
              )}
            >
              <Luggage aria-hidden className="size-4" />
              <span className="max-sm:sr-only">Trips</span>
            </Link>
            <Link
              href="/wishlists"
              aria-current={current("/wishlists")}
              className={cn(
                navLink,
                "max-sm:hidden",
                current("/wishlists") && "bg-checkin-mist/60",
              )}
            >
              <Heart aria-hidden className="size-4" />
              <span className="max-sm:sr-only">Wishlists</span>
            </Link>
            <UnreadLinks current={current} />
            <span className="ml-1">
              {/* Narrow headers hide Trips and Wishlists; they stay reachable here. */}
              <UserButton>
                <UserButton.MenuItems>
                  <UserButton.Link
                    label="Trips"
                    href="/trips"
                    labelIcon={<Luggage aria-hidden className="size-4" />}
                  />
                  <UserButton.Link
                    label="Wishlists"
                    href="/wishlists"
                    labelIcon={<Heart aria-hidden className="size-4" />}
                  />
                </UserButton.MenuItems>
              </UserButton>
            </span>
          </Show>
          <Show when="signed-out">
            <SignInButton mode="modal">
              <button className={navLink}>Sign in</button>
            </SignInButton>
            <SignUpButton mode="modal">
              <button className="h-11 rounded-[0.7rem] bg-checkin-ink px-4 text-sm font-semibold text-checkin-canvas transition-colors hover:bg-checkin-ink/90 focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-checkin-signal/35 max-sm:hidden">
                Sign up
              </button>
            </SignUpButton>
          </Show>
        </div>
      </nav>
    </header>
  );
}

function UnreadLinks({
  current,
}: {
  current: (prefix: string) => "page" | undefined;
}) {
  const profileReady = useProfileReady();
  const summary = useQuery(
    api.dashboard.unreadSummary,
    profileReady ? {} : "skip",
  );
  const links = [
    {
      href: "/inbox",
      label: "Messages",
      Icon: MessageCircle,
      badge: summary && badgeCount(summary.conversations, summary.capped),
    },
    {
      href: "/notifications",
      label: "Notifications",
      Icon: Bell,
      badge: summary && badgeCount(summary.notifications, summary.capped),
    },
  ];
  return links.map(({ href, label, Icon, badge }) => (
    <Link
      key={href}
      href={href}
      aria-current={current(href)}
      className={cn(navLink, "relative", current(href) && "bg-checkin-mist/60")}
    >
      <Icon aria-hidden className="size-4" />
      <span className="sr-only">
        {label}
        {badge ? `, ${badge} unread` : ""}
      </span>
      {badge ? (
        <span
          aria-hidden
          className="absolute top-0.5 right-0.5 grid h-4.5 min-w-4.5 place-items-center rounded-full bg-checkin-signal px-1 text-[0.65rem] leading-none font-bold text-white tabular-nums"
        >
          {badge}
        </span>
      ) : null}
    </Link>
  ));
}
