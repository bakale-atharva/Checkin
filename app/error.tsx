"use client";

import { CloudOff } from "lucide-react";
import { useEffect } from "react";

import { RetryButton, RouteMessage } from "@/components/route-message";

/** Catch-all for unexpected failures below the root layout; the header stays usable. */
export default function AppError({
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
    <RouteMessage
      icon={CloudOff}
      title="Something went wrong"
      href="/"
      linkLabel="Back to stays"
      action={<RetryButton onRetry={retry} />}
    >
      <p>
        This page didn&apos;t load. Check your connection and try again; your
        bookings and messages are safe.
      </p>
    </RouteMessage>
  );
}
