"use client";

import Link from "next/link";

/** Shown when the conversation doesn't exist or the viewer isn't a participant. */
export default function ConversationError() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-3 px-6 py-24 text-center">
      <h1 className="text-2xl font-semibold">
        We couldn&apos;t open this conversation
      </h1>
      <p className="text-checkin-muted">
        It may belong to a different account, or the link is incomplete.
      </p>
      <Link
        href="/inbox"
        className="mt-2 inline-flex min-h-11 items-center font-semibold underline underline-offset-4"
      >
        Back to messages
      </Link>
    </div>
  );
}
