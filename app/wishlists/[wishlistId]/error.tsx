"use client";

import { Heart } from "lucide-react";

import { RetryButton, RouteMessage } from "@/components/route-message";

/** Shown when the wishlist doesn't exist, belongs to someone else, or failed to load. */
export default function WishlistError({ retry }: { retry: () => void }) {
  return (
    <RouteMessage
      icon={Heart}
      title="We couldn’t open this wishlist"
      href="/wishlists"
      linkLabel="Back to wishlists"
      action={<RetryButton onRetry={retry} />}
    >
      <p>Wishlists are private, so it may belong to a different account.</p>
    </RouteMessage>
  );
}
