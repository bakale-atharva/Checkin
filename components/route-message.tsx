import type { LucideIcon } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

export const routeActionClass =
  "inline-flex min-h-11 items-center justify-center gap-2 rounded-[0.8rem] px-4 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-checkin-signal/35";

/**
 * A centred, full-page message for error, not-found, and permission states.
 * Nested routes that already sit inside a `<main>` (the inbox) pass
 * `as="div"` so the page keeps a single main landmark.
 */
export function RouteMessage({
  icon: Icon,
  title,
  children,
  href,
  linkLabel,
  action,
  as: Tag = "main",
}: {
  icon?: LucideIcon;
  title: string;
  children: ReactNode;
  href: string;
  linkLabel: string;
  action?: ReactNode;
  as?: "main" | "div";
}) {
  return (
    <Tag className="mx-auto flex w-full max-w-xl flex-1 flex-col items-center justify-center gap-3 px-4 py-24 text-center">
      {Icon ? <Icon aria-hidden className="size-8 text-checkin-muted" /> : null}
      <h1 className="text-2xl font-semibold text-balance">{title}</h1>
      <div className="text-checkin-muted text-pretty">{children}</div>
      <div className="mt-2 flex flex-wrap items-center justify-center gap-2">
        {action}
        <Link
          href={href}
          className={cn(
            routeActionClass,
            action
              ? "border border-checkin-line text-checkin-ink hover:bg-checkin-mist/45"
              : "underline underline-offset-4 hover:bg-checkin-mist/45",
          )}
        >
          {linkLabel}
        </Link>
      </div>
    </Tag>
  );
}

/** A "Try again" button for error boundaries; `retry` re-fetches the segment. */
export function RetryButton({ onRetry }: { onRetry: () => void }) {
  return (
    <button
      type="button"
      onClick={onRetry}
      className={cn(
        routeActionClass,
        "bg-checkin-ink text-checkin-canvas hover:bg-checkin-ink/90",
      )}
    >
      Try again
    </button>
  );
}
