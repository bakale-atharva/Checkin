"use client";

import Link from "next/link";

/** Shown when the reservation doesn't exist or the viewer isn't on it. */
export default function ReviewError() {
  return (
    <main className="mx-auto flex w-full max-w-xl flex-1 flex-col items-center justify-center gap-3 px-4 py-24 text-center">
      <h1 className="text-2xl font-semibold">
        We couldn&apos;t open this review
      </h1>
      <p className="text-checkin-muted">
        It may belong to a different account, or the link is incomplete.
      </p>
      <Link
        href="/notifications"
        className="mt-2 inline-flex min-h-11 items-center font-semibold underline underline-offset-4"
      >
        Back to notifications
      </Link>
    </main>
  );
}
