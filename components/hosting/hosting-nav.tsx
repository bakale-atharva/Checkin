"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { cn } from "@/lib/utils";

const links = [
  { href: "/hosting", label: "Listings" },
  { href: "/hosting/calendar", label: "Calendar" },
  { href: "/hosting/plans", label: "Plan & billing" },
] as const;

export function HostingNav() {
  const pathname = usePathname();
  const isCurrent = (href: string) =>
    href === "/hosting"
      ? pathname === "/hosting" || pathname.startsWith("/hosting/listings")
      : pathname.startsWith(href);

  return (
    <nav
      aria-label="Hosting"
      className="border-b border-checkin-line bg-checkin-canvas"
    >
      <ul className="mx-auto flex w-full max-w-[90rem] gap-1 overflow-x-auto px-4 sm:px-6 lg:px-8">
        {links.map((link) => (
          <li key={link.href}>
            <Link
              href={link.href}
              aria-current={isCurrent(link.href) ? "page" : undefined}
              className={cn(
                "inline-flex min-h-11 items-center border-b-2 border-transparent px-3 text-sm font-semibold whitespace-nowrap text-checkin-muted transition-colors hover:text-checkin-ink focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-checkin-signal/35",
                isCurrent(link.href) && "border-checkin-ink text-checkin-ink",
              )}
            >
              {link.label}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
