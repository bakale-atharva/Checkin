"use client";

import { DoorOpen } from "lucide-react";

import { RetryButton, RouteMessage } from "@/components/route-message";

/** Shown when the stay link is malformed or the stay failed to load. */
export default function ListingError({ retry }: { retry: () => void }) {
  return (
    <RouteMessage
      icon={DoorOpen}
      title="We couldn’t open this stay"
      href="/"
      linkLabel="Browse other stays"
      action={<RetryButton onRetry={retry} />}
    >
      <p>
        The link may be incomplete, or the connection dropped. Your existing
        reservations aren&apos;t affected.
      </p>
    </RouteMessage>
  );
}
