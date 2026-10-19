"use client";

import { useQuery } from "convex/react";
import { useState } from "react";

import { useProfileReady } from "@/components/use-profile-ready";
import { api } from "@/convex/_generated/api";
import { publicationAllowance } from "@/lib/billing/host-plan-policy";

/**
 * The host's listings with their publication allowance. The server enforces the
 * limit on publish; this mirrors it so the UI can explain it beforehand.
 */
export function useHostAllowance() {
  const profileReady = useProfileReady();
  const listings = useQuery(
    api.listings.myListings,
    profileReady ? {} : "skip",
  );
  const subscription = useQuery(
    api.billing.currentHostSubscription,
    profileReady ? {} : "skip",
  );
  const [now] = useState(() => Date.now());
  const loaded = listings !== undefined && subscription !== undefined;
  const allowance = publicationAllowance(subscription ?? null, now);
  const published = (listings ?? []).filter(
    (listing) => listing.status === "published",
  );
  return {
    loaded,
    listings,
    subscription,
    allowance,
    isPro: allowance > 1,
    publishedCount: published.length,
    published,
    canPublishAnother: published.length < allowance,
  };
}
