"use client";

import { usePaginatedQuery } from "convex/react";
import { MessagesSquare } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { useProfileReady } from "@/components/use-profile-ready";
import { api } from "@/convex/_generated/api";
import { cn } from "@/lib/utils";
import {
  Avatar,
  displayName,
  formatActivity,
  stayLabel,
  type InboxEntry,
} from "./shared";

export function InboxList({ selectedId }: { selectedId?: string }) {
  const profileReady = useProfileReady();
  const { results, status, loadMore } = usePaginatedQuery(
    api.dashboard.inbox,
    profileReady ? {} : "skip",
    { initialNumItems: 20 },
  );
  const [now] = useState(() => Date.now());
  const entries = results as InboxEntry[];

  return (
    <section aria-labelledby="inbox-heading" className="flex min-h-0 flex-col">
      <div className="border-b border-checkin-line px-4 py-4 sm:px-5">
        <h1
          id="inbox-heading"
          className="text-2xl font-semibold tracking-[-0.04em]"
        >
          Messages
        </h1>
        <p className="text-sm text-checkin-muted">
          Private conversations about your stays and guests.
        </p>
      </div>

      {status === "LoadingFirstPage" ? (
        <p role="status" className="px-5 py-6 text-sm text-checkin-muted">
          Loading conversations…
        </p>
      ) : entries.length === 0 ? (
        <div className="m-4 flex gap-3 rounded-[1rem] border border-dashed border-checkin-line px-5 py-6 text-sm text-checkin-muted">
          <MessagesSquare aria-hidden className="size-5 shrink-0" />
          <p>
            No conversations yet. Message a host from a trip, or a guest from a
            booking request, and it shows up here.
          </p>
        </div>
      ) : (
        <ul className="min-h-0 flex-1 overflow-y-auto">
          {entries.map((entry) => {
            const name = displayName(entry.participant?.name);
            const selected = entry.conversationId === selectedId;
            return (
              <li key={entry.conversationId}>
                <Link
                  href={`/inbox/${entry.conversationId}`}
                  aria-current={selected ? "page" : undefined}
                  className={cn(
                    "flex gap-3 border-b border-checkin-line/70 px-4 py-4 transition-colors hover:bg-checkin-mist/40 focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-inset focus-visible:ring-checkin-signal/35 sm:px-5",
                    selected && "bg-checkin-mist/60",
                  )}
                >
                  <Avatar name={entry.participant?.name} />
                  <span className="min-w-0 flex-1">
                    <span className="flex items-baseline justify-between gap-2">
                      <span
                        className={cn(
                          "truncate",
                          entry.unread ? "font-bold" : "font-semibold",
                        )}
                      >
                        {name}
                      </span>
                      {entry.latestMessageAt ? (
                        <span className="shrink-0 text-xs text-checkin-muted">
                          {formatActivity(entry.latestMessageAt, now)}
                        </span>
                      ) : null}
                    </span>
                    {entry.reservation ? (
                      <span className="block truncate text-sm text-checkin-muted">
                        {entry.reservation.role === "guest"
                          ? "Your host · "
                          : "Your guest · "}
                        {entry.reservation.listingTitle ?? "Listing"}
                      </span>
                    ) : null}
                    <span className="flex items-center justify-between gap-2 text-xs text-checkin-muted">
                      <span className="truncate">
                        {entry.reservation
                          ? stayLabel(entry.reservation)
                          : null}
                        {entry.latestMessageAt ? null : " · No messages yet"}
                      </span>
                      {entry.unread ? (
                        <span className="inline-flex shrink-0 items-center gap-1.5 font-semibold text-checkin-signal">
                          <span
                            aria-hidden
                            className="size-2 rounded-full bg-checkin-signal"
                          />
                          Unread
                        </span>
                      ) : null}
                    </span>
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
      {status === "CanLoadMore" ? (
        <div className="p-4">
          <Button
            type="button"
            variant="outline"
            className="w-full"
            onClick={() => loadMore(20)}
          >
            Load more conversations
          </Button>
        </div>
      ) : null}
    </section>
  );
}
