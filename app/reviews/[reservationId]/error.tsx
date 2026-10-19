"use client";

import { Star } from "lucide-react";

import { RetryButton, RouteMessage } from "@/components/route-message";

/** Shown when the reservation doesn't exist, the viewer isn't on it, or it failed to load. */
export default function ReviewError({ retry }: { retry: () => void }) {
  return (
    <RouteMessage
      icon={Star}
      title="We couldn’t open this review"
      href="/notifications"
      linkLabel="Back to notifications"
      action={<RetryButton onRetry={retry} />}
    >
      <p>It may belong to a different account, or the link is incomplete.</p>
    </RouteMessage>
  );
}
