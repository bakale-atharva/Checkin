"use client";

import { House } from "lucide-react";

import { RetryButton, RouteMessage } from "@/components/route-message";

/** Hosting failures keep the hosting tabs above them so hosts can move on. */
export default function HostingError({ retry }: { retry: () => void }) {
  return (
    <RouteMessage
      icon={House}
      title="We couldn’t load this hosting page"
      href="/hosting"
      linkLabel="Back to your listings"
      action={<RetryButton onRetry={retry} />}
    >
      <p>
        If you opened a listing, it may belong to a different account. Your
        bookings and guests aren&apos;t affected.
      </p>
    </RouteMessage>
  );
}
