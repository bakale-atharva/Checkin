export const FREE_HOST_PUBLICATION_ALLOWANCE = 1;
export const HOST_PRO_PUBLICATION_ALLOWANCE = 10;

export type HostSubscription = {
  planSlug: string;
  status: string;
  effectiveUntil: number | null;
};

export function publicationAllowance(
  subscription: HostSubscription | null,
  now: number,
) {
  if (
    subscription?.planSlug === "host_pro" &&
    (subscription.status === "active" || subscription.status === "canceled") &&
    (subscription.effectiveUntil === null || subscription.effectiveUntil > now)
  ) {
    return HOST_PRO_PUBLICATION_ALLOWANCE;
  }

  return FREE_HOST_PUBLICATION_ALLOWANCE;
}

export function selectFreeListing(
  publishedListings: ReadonlyArray<{ id: string; publishedAt: number }>,
  selectedListingId: string | null,
) {
  if (
    selectedListingId !== null &&
    publishedListings.some((listing) => listing.id === selectedListingId)
  ) {
    return selectedListingId;
  }

  return publishedListings.reduce<string | null>((oldestId, listing) => {
    if (oldestId === null) return listing.id;
    const oldest = publishedListings.find(
      (candidate) => candidate.id === oldestId,
    );
    return oldest && oldest.publishedAt <= listing.publishedAt
      ? oldestId
      : listing.id;
  }, null);
}
