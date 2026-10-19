"use client";

import { useMutation, usePaginatedQuery, useQuery } from "convex/react";
import { AlertCircle, ArrowLeft, RotateCw, Send } from "lucide-react";
import Link from "next/link";
import {
  Fragment,
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type FormEvent,
  type KeyboardEvent,
} from "react";

import { errorMessage } from "@/components/hosting/form-controls";
import { Button } from "@/components/ui/button";
import { useProfileReady } from "@/components/use-profile-ready";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import {
  dayLabel,
  firstUnreadIndex,
  groupMessagesByDay,
  reservationHref,
} from "@/lib/messaging/inbox-presentation";
import { cn } from "@/lib/utils";
import { Avatar, displayName, formatMessageTime, stayLabel } from "./shared";

const MAX_MESSAGE_LENGTH = 2_000;
const countFormat = new Intl.NumberFormat("en-US");

type OutboxMessage = {
  localId: string;
  body: string;
  status: "sending" | "failed";
  error?: string;
};

export function ConversationThread({
  conversationId,
}: {
  conversationId: Id<"conversations">;
}) {
  const profileReady = useProfileReady();
  const detail = useQuery(
    api.dashboard.conversationDetail,
    profileReady ? { conversationId } : "skip",
  );
  const {
    results,
    status: pageStatus,
    loadMore,
  } = usePaginatedQuery(
    api.dashboard.conversationMessages,
    profileReady ? { conversationId } : "skip",
    { initialNumItems: 30 },
  );
  const sendMessage = useMutation(api.dashboard.sendMessage);
  const markRead = useMutation(api.dashboard.markConversationRead);

  const [outbox, setOutbox] = useState<OutboxMessage[]>([]);
  const [draft, setDraft] = useState("");
  const [now] = useState(() => Date.now());
  // Frozen when the thread opens so the "New" divider doesn't jump as we mark it read.
  const [readMarker, setReadMarker] = useState<number | null | undefined>(
    undefined,
  );
  const scrollRef = useRef<HTMLDivElement>(null);
  const pinnedToBottom = useRef(true);

  if (detail && readMarker === undefined) setReadMarker(detail.lastReadAt);

  // Pages arrive newest first.
  const messages = [...results].reverse();
  const latestIncoming = detail
    ? results.find(
        (message) => message.senderProfileId !== detail.viewerProfileId,
      )?.createdAt
    : undefined;

  // Advance the read position whenever a newer message arrives while the thread is visible.
  useEffect(() => {
    if (!detail || latestIncoming === undefined) return;
    if (latestIncoming <= (detail.lastReadAt ?? 0)) return;
    const mark = () => {
      if (document.visibilityState === "visible")
        void markRead({ conversationId }).catch(() => undefined);
    };
    mark();
    document.addEventListener("visibilitychange", mark);
    return () => document.removeEventListener("visibilitychange", mark);
  }, [conversationId, detail, latestIncoming, markRead]);

  // Keep the newest message in view unless the reader has scrolled up.
  useLayoutEffect(() => {
    const element = scrollRef.current;
    if (element && pinnedToBottom.current)
      element.scrollTop = element.scrollHeight;
  }, [messages.length, outbox.length]);

  const deliver = useCallback(
    async (localId: string, body: string) => {
      setOutbox((current) =>
        current.map((item) =>
          item.localId === localId
            ? { ...item, status: "sending", error: undefined }
            : item,
        ),
      );
      try {
        await sendMessage({ conversationId, body });
        // The live query already includes the stored message when this resolves.
        setOutbox((current) =>
          current.filter((item) => item.localId !== localId),
        );
      } catch (caught) {
        setOutbox((current) =>
          current.map((item) =>
            item.localId === localId
              ? {
                  ...item,
                  status: "failed",
                  error: errorMessage(
                    caught,
                    "Not sent. Check your connection.",
                  ),
                }
              : item,
          ),
        );
      }
    },
    [conversationId, sendMessage],
  );

  function submit(event?: FormEvent) {
    event?.preventDefault();
    const body = draft.trim();
    if (!body || body.length > MAX_MESSAGE_LENGTH) return;
    const localId = crypto.randomUUID();
    pinnedToBottom.current = true;
    setOutbox((current) => [...current, { localId, body, status: "sending" }]);
    setDraft("");
    void deliver(localId, body);
  }

  function onComposerKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (
      event.key === "Enter" &&
      !event.shiftKey &&
      !event.nativeEvent.isComposing
    ) {
      event.preventDefault();
      submit();
    }
  }

  if (detail === undefined)
    return (
      <p role="status" className="p-6 text-sm text-checkin-muted">
        Loading conversation…
      </p>
    );

  const name = displayName(detail.counterpart?.name);
  const unreadIndex =
    readMarker === undefined
      ? -1
      : firstUnreadIndex(messages, readMarker, detail.viewerProfileId);
  const unreadFrom = unreadIndex >= 0 ? messages[unreadIndex]._id : undefined;
  const tooLong = draft.trim().length > MAX_MESSAGE_LENGTH;

  return (
    <section
      aria-labelledby="thread-heading"
      className="flex h-full min-h-0 flex-col"
    >
      <header className="flex items-center gap-3 border-b border-checkin-line px-4 py-3 sm:px-5">
        <Link
          href="/inbox"
          className="grid size-11 shrink-0 place-items-center rounded-full hover:bg-checkin-mist/60 focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-checkin-signal/35 lg:hidden"
        >
          <ArrowLeft aria-hidden className="size-5" />
          <span className="sr-only">All messages</span>
        </Link>
        <Avatar name={detail.counterpart?.name} />
        <div className="min-w-0 flex-1">
          <h2 id="thread-heading" className="truncate font-semibold">
            {name}
          </h2>
          {detail.reservation ? (
            <p className="truncate text-sm text-checkin-muted">
              {detail.reservation.listingTitle ?? "Listing"} ·{" "}
              {stayLabel(detail.reservation)}
            </p>
          ) : null}
        </div>
        {detail.reservation ? (
          <Link
            href={reservationHref(detail.reservation)}
            className="inline-flex min-h-11 shrink-0 items-center rounded-[0.7rem] border border-checkin-line px-3 text-sm font-semibold hover:bg-checkin-mist/45 focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-checkin-signal/35"
          >
            {detail.reservation.role === "guest"
              ? "View trip"
              : "View calendar"}
          </Link>
        ) : null}
      </header>

      <div
        ref={scrollRef}
        onScroll={(event) => {
          const element = event.currentTarget;
          pinnedToBottom.current =
            element.scrollHeight - element.scrollTop - element.clientHeight <
            80;
        }}
        className="min-h-0 flex-1 overflow-y-auto px-4 py-4 sm:px-5"
      >
        {pageStatus === "CanLoadMore" ? (
          <div className="mb-4 flex justify-center">
            <Button
              type="button"
              variant="quiet"
              size="sm"
              onClick={() => {
                pinnedToBottom.current = false;
                loadMore(30);
              }}
            >
              Load earlier messages
            </Button>
          </div>
        ) : null}
        {pageStatus === "LoadingFirstPage" ? (
          <p role="status" className="text-sm text-checkin-muted">
            Loading messages…
          </p>
        ) : messages.length === 0 && outbox.length === 0 ? (
          <p className="mx-auto max-w-sm py-10 text-center text-sm text-checkin-muted">
            Say hello to {name.split(" ")[0]}. Only the two of you can read this
            conversation.
          </p>
        ) : null}

        <ol
          role="log"
          aria-label={`Messages with ${name}`}
          className="space-y-1"
        >
          {groupMessagesByDay(messages).map((group) => (
            <Fragment key={group.day}>
              <li className="py-3 text-center text-xs font-semibold text-checkin-muted">
                {dayLabel(group.day, now)}
              </li>
              {group.messages.map((message) => {
                const mine = message.senderProfileId === detail.viewerProfileId;
                return (
                  <Fragment key={message._id}>
                    {message._id === unreadFrom ? (
                      <li className="flex items-center gap-3 py-2 text-xs font-semibold text-checkin-signal">
                        <span className="h-px flex-1 bg-checkin-signal/40" />
                        New messages
                        <span className="h-px flex-1 bg-checkin-signal/40" />
                      </li>
                    ) : null}
                    <MessageBubble
                      mine={mine}
                      body={message.body}
                      meta={formatMessageTime(message.createdAt)}
                      sender={mine ? "You" : name}
                    />
                  </Fragment>
                );
              })}
            </Fragment>
          ))}
          {outbox.map((item) => (
            <MessageBubble
              key={item.localId}
              mine
              body={item.body}
              sender="You"
              pending={item.status === "sending"}
              meta={
                item.status === "sending" ? (
                  "Sending…"
                ) : (
                  <span className="inline-flex flex-wrap items-center justify-end gap-x-2 text-checkin-signal">
                    <AlertCircle aria-hidden className="size-3.5" />
                    {item.error}
                    <button
                      type="button"
                      onClick={() => void deliver(item.localId, item.body)}
                      className="inline-flex min-h-8 items-center gap-1 font-semibold underline underline-offset-2"
                    >
                      <RotateCw aria-hidden className="size-3.5" />
                      Retry
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        setOutbox((current) =>
                          current.filter(
                            (candidate) => candidate.localId !== item.localId,
                          ),
                        )
                      }
                      className="min-h-8 font-semibold text-checkin-muted underline underline-offset-2"
                    >
                      Discard
                    </button>
                  </span>
                )
              }
            />
          ))}
        </ol>
      </div>

      <form
        onSubmit={submit}
        className="border-t border-checkin-line px-4 py-3 sm:px-5"
      >
        <label htmlFor="message-composer" className="sr-only">
          Message {name}
        </label>
        <div className="flex items-end gap-2">
          <textarea
            id="message-composer"
            rows={1}
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={onComposerKeyDown}
            placeholder={`Message ${name.split(" ")[0]}`}
            aria-describedby="composer-hint"
            aria-invalid={tooLong || undefined}
            className="field-sizing-content max-h-40 min-h-11 w-full resize-none rounded-[0.8rem] border border-checkin-line bg-checkin-paper px-3 py-2.5 text-sm leading-relaxed placeholder:text-checkin-muted/80 focus-visible:border-checkin-ink focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-checkin-signal/25"
          />
          <Button
            type="submit"
            disabled={!draft.trim() || tooLong}
            className="shrink-0"
          >
            <Send aria-hidden className="size-4" />
            <span className="max-sm:sr-only">Send</span>
          </Button>
        </div>
        <p
          id="composer-hint"
          className={cn(
            "mt-1.5 text-xs text-checkin-muted",
            tooLong && "font-semibold text-checkin-signal",
          )}
        >
          {tooLong
            ? `${countFormat.format(draft.trim().length)} / ${countFormat.format(MAX_MESSAGE_LENGTH)} characters — shorten your message to send it.`
            : "Enter to send, Shift + Enter for a new line. Keep payments and contact details on Checkin."}
        </p>
      </form>
    </section>
  );
}

function MessageBubble({
  mine,
  body,
  meta,
  sender,
  pending,
}: {
  mine: boolean;
  body: string;
  meta: React.ReactNode;
  sender: string;
  pending?: boolean;
}) {
  return (
    <li
      className={cn("flex flex-col py-1", mine ? "items-end" : "items-start")}
    >
      <span className="sr-only">{sender}: </span>
      <p
        className={cn(
          "max-w-[min(32rem,85%)] rounded-[1.1rem] px-4 py-2.5 text-sm leading-relaxed break-words whitespace-pre-wrap",
          mine
            ? "rounded-br-[0.35rem] bg-checkin-ink text-checkin-canvas"
            : "rounded-bl-[0.35rem] bg-checkin-paper ring-1 ring-checkin-line",
          pending && "opacity-60",
        )}
      >
        {body}
      </p>
      <span className="mt-1 px-1 text-right text-xs text-checkin-muted">
        {meta}
      </span>
    </li>
  );
}
