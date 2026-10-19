"use client";

import { useMutation, usePaginatedQuery } from "convex/react";
import { Bell, CalendarCheck, MessageCircle, Star } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

import { errorMessage } from "@/components/hosting/form-controls";
import { formatActivity } from "@/components/messaging/shared";
import { Button } from "@/components/ui/button";
import { useProfileReady } from "@/components/use-profile-ready";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import {
  notificationCopy,
  notificationHref,
  type NotificationKind,
} from "@/lib/messaging/inbox-presentation";
import { cn } from "@/lib/utils";

const icons: Record<NotificationKind, typeof Bell> = {
  message: MessageCircle,
  review_eligible: Star,
  reservation_action: CalendarCheck,
};

export function NotificationsList() {
  const profileReady = useProfileReady();
  const { results, status, loadMore } = usePaginatedQuery(
    api.dashboard.notifications,
    profileReady ? {} : "skip",
    { initialNumItems: 25 },
  );
  const markRead = useMutation(api.dashboard.markNotificationRead);
  const markAllRead = useMutation(api.dashboard.markAllNotificationsRead);
  const [now] = useState(() => Date.now());
  const [error, setError] = useState<string | null>(null);
  const [clearing, setClearing] = useState(false);
  const anyUnread = results.some((item) => item.readAt === undefined);

  async function clearAll() {
    setClearing(true);
    setError(null);
    try {
      await markAllRead({});
    } catch (caught) {
      setError(errorMessage(caught, "Couldn't mark notifications as read."));
    } finally {
      setClearing(false);
    }
  }

  function open(notificationId: Id<"notifications">, unread: boolean) {
    if (unread) void markRead({ notificationId }).catch(() => undefined);
  }

  return (
    <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-8 sm:px-6 lg:px-8">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-3xl font-semibold tracking-[-0.05em]">
            Notifications
          </h1>
          <p className="text-checkin-muted">
            Reservation updates, new messages, and review reminders.
          </p>
        </div>
        {anyUnread ? (
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={clearing}
            onClick={() => void clearAll()}
          >
            Mark all as read
          </Button>
        ) : null}
      </div>
      {error ? (
        <p
          role="alert"
          className="mt-3 text-sm font-medium text-checkin-signal"
        >
          {error}
        </p>
      ) : null}

      {status === "LoadingFirstPage" ? (
        <p role="status" className="mt-8 text-sm text-checkin-muted">
          Loading notifications…
        </p>
      ) : results.length === 0 ? (
        <div className="mt-8 flex gap-3 rounded-[1rem] border border-dashed border-checkin-line px-5 py-6 text-sm text-checkin-muted">
          <Bell aria-hidden className="size-5 shrink-0" />
          You&apos;re all caught up. Booking changes, messages, and review
          reminders will show up here.
        </div>
      ) : (
        <ul className="mt-8 divide-y divide-checkin-line overflow-hidden rounded-[1.1rem] border border-checkin-line bg-checkin-paper">
          {results.map((notification) => {
            const unread = notification.readAt === undefined;
            const copy = notificationCopy(notification);
            const href = notificationHref(notification);
            const Icon = icons[notification.kind];
            const content = (
              <>
                <span
                  className={cn(
                    "grid size-10 shrink-0 place-items-center rounded-full",
                    unread
                      ? "bg-checkin-signal/12 text-checkin-signal"
                      : "bg-checkin-mist",
                  )}
                >
                  <Icon aria-hidden className="size-4" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex items-baseline justify-between gap-3">
                    <span className={unread ? "font-bold" : "font-semibold"}>
                      {copy.title}
                      {unread ? (
                        <span className="sr-only"> (unread)</span>
                      ) : null}
                    </span>
                    <span className="shrink-0 text-xs text-checkin-muted">
                      {formatActivity(notification.createdAt, now)}
                    </span>
                  </span>
                  <span className="block text-sm text-checkin-muted">
                    {copy.body}
                  </span>
                </span>
                {unread ? (
                  <span
                    aria-hidden
                    className="mt-2 size-2 shrink-0 rounded-full bg-checkin-signal"
                  />
                ) : null}
              </>
            );
            const rowClass =
              "flex gap-3 px-5 py-4 transition-colors focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-inset focus-visible:ring-checkin-signal/35";
            return (
              <li key={notification._id}>
                {href ? (
                  <Link
                    href={href}
                    onClick={() => open(notification._id, unread)}
                    className={cn(rowClass, "hover:bg-checkin-mist/40")}
                  >
                    {content}
                  </Link>
                ) : (
                  <button
                    type="button"
                    onClick={() => open(notification._id, unread)}
                    className={cn(rowClass, "w-full text-left")}
                  >
                    {content}
                  </button>
                )}
              </li>
            );
          })}
        </ul>
      )}
      {status === "CanLoadMore" ? (
        <Button
          type="button"
          variant="outline"
          className="mt-4"
          onClick={() => loadMore(25)}
        >
          Load older notifications
        </Button>
      ) : null}
    </main>
  );
}
