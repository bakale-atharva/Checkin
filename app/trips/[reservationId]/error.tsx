"use client";

import Link from "next/link";

/** Shown when the trip doesn't exist or belongs to someone else. */
export default function TripError() {
  return (
    <main className="mx-auto flex w-full max-w-xl flex-1 flex-col items-center justify-center gap-3 px-4 py-24 text-center">
      <h1 className="text-2xl font-semibold">
        We couldn&apos;t open this trip
      </h1>
      <p className="text-checkin-muted">
        It may belong to a different account, or the link is incomplete.
      </p>
      <Link
        href="/trips"
        className="mt-2 font-semibold underline underline-offset-4"
      >
        Back to your trips
      </Link>
    </main>
  );
}
