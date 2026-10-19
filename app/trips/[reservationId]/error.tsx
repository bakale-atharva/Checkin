"use client";

import { Luggage } from "lucide-react";

import { RetryButton, RouteMessage } from "@/components/route-message";

/** Shown when the trip doesn't exist, belongs to someone else, or failed to load. */
export default function TripError({ retry }: { retry: () => void }) {
  return (
    <RouteMessage
      icon={Luggage}
      title="We couldn’t open this trip"
      href="/trips"
      linkLabel="Back to your trips"
      action={<RetryButton onRetry={retry} />}
    >
      <p>It may belong to a different account, or the link is incomplete.</p>
    </RouteMessage>
  );
}
