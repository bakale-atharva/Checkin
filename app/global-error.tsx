"use client";

import { useEffect } from "react";

import "./globals.css";

/**
 * Replaces the root layout when it fails (for example, if Clerk or Convex
 * can't initialise), so it brings its own document and avoids app providers.
 */
export default function GlobalError({
  error,
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <html lang="en">
      <body className="flex min-h-dvh flex-col items-center justify-center gap-3 px-4 text-center">
        <title>Checkin is unavailable</title>
        <p className="text-xl font-bold tracking-[-0.06em]">Checkin</p>
        <h1 className="text-2xl font-semibold">Checkin couldn’t start</h1>
        <p className="max-w-md text-checkin-muted">
          Something went wrong while loading the app. Try again in a moment.
        </p>
        <button
          type="button"
          onClick={retry}
          className="mt-2 inline-flex min-h-11 items-center rounded-[0.8rem] bg-checkin-ink px-4 text-sm font-semibold text-checkin-canvas focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-checkin-signal/35"
        >
          Try again
        </button>
      </body>
    </html>
  );
}
