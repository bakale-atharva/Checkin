"use client";

import { useMutation } from "convex/react";
import { House, Plus } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Surface } from "@/components/ui/surface";
import { api } from "@/convex/_generated/api";
import type { Doc } from "@/convex/_generated/dataModel";
import { formatNightlyPrice } from "@/lib/discovery/catalog";
import { BookingRequests } from "./booking-requests";
import { errorMessage } from "./form-controls";
import { ListingStatusBadge } from "./listing-status-badge";
import { useHostAllowance } from "./use-host-allowance";

const actionLink =
  "inline-flex h-9 items-center rounded-[0.8rem] px-3 text-xs font-semibold transition-colors hover:bg-checkin-mist/60 focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-checkin-signal/35";

export function HostingOverview() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const createDraft = useMutation(api.listings.createDraft);
  const setStatus = useMutation(api.listings.setStatus);
  const deleteDraft = useMutation(api.listings.deleteDraft);
  const allowance = useHostAllowance();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const listings = allowance.listings;

  async function run(
    id: string,
    action: () => Promise<unknown>,
    fallback: string,
  ) {
    setBusyId(id);
    setError(null);
    try {
      await action();
    } catch (caught) {
      setError(errorMessage(caught, fallback));
    } finally {
      setBusyId(null);
    }
  }

  async function startListing() {
    await run(
      "new",
      async () => {
        const listing = await createDraft({});
        router.push(`/hosting/listings/${listing._id}`);
      },
      "Couldn't start a new listing.",
    );
  }

  function confirmThen(message: string, action: () => void) {
    if (window.confirm(message)) action();
  }

  return (
    <main className="mx-auto w-full max-w-[90rem] flex-1 px-4 py-10 sm:px-6 lg:px-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold tracking-[-0.05em]">
            Your properties
          </h1>
          <p className="mt-1 text-checkin-muted">
            Drafts, published stays, and archived properties on this account.
          </p>
        </div>
        <Button
          type="button"
          disabled={busyId === "new"}
          onClick={() => void startListing()}
        >
          <Plus aria-hidden className="size-4" />
          {busyId === "new" ? "Starting…" : "Create a listing"}
        </Button>
      </div>

      {searchParams.get("published") ? (
        <p
          role="status"
          className="mt-6 rounded-[0.9rem] border border-checkin-line bg-checkin-mist/50 px-4 py-3 text-sm font-medium"
        >
          Your listing is live. Guests can now find and book it.
        </p>
      ) : null}

      {allowance.loaded ? (
        <Surface className="mt-6 flex flex-wrap items-center justify-between gap-4 px-5 py-4">
          <div>
            <p className="text-sm text-checkin-muted">
              {allowance.isPro ? "Host Pro" : "Free Host"} plan
            </p>
            <p className="font-semibold">
              {allowance.publishedCount} of {allowance.allowance} published{" "}
              {allowance.allowance === 1 ? "listing" : "listings"} used
            </p>
            <div
              role="progressbar"
              aria-label="Published listings used"
              aria-valuemin={0}
              aria-valuemax={allowance.allowance}
              aria-valuenow={Math.min(
                allowance.publishedCount,
                allowance.allowance,
              )}
              className="mt-2 h-1.5 w-48 overflow-hidden rounded-full bg-checkin-line"
            >
              <div
                className="h-full rounded-full bg-checkin-ink"
                style={{
                  width: `${Math.min(100, (allowance.publishedCount / allowance.allowance) * 100)}%`,
                }}
              />
            </div>
          </div>
          <Link
            href="/hosting/plans"
            className={`${actionLink} border border-checkin-line`}
          >
            {allowance.isPro ? "Manage plan" : "Upgrade to Host Pro"}
          </Link>
        </Surface>
      ) : null}

      {error ? (
        <p
          role="alert"
          className="mt-4 text-sm font-medium text-checkin-signal"
        >
          {error}
        </p>
      ) : null}

      {listings === undefined ? (
        <p className="mt-10 text-checkin-muted">Loading properties…</p>
      ) : listings.length === 0 ? (
        <div className="mt-8 flex flex-col items-center gap-3 rounded-[1.25rem] border border-dashed border-checkin-line px-6 py-16 text-center">
          <House aria-hidden className="size-7 text-checkin-muted" />
          <p className="font-semibold">
            You haven&apos;t listed a property yet
          </p>
          <p className="max-w-sm text-sm text-checkin-muted">
            Your draft saves as you go, so you can finish it later. Free hosts
            can publish one property; Host Pro raises that to ten.
          </p>
          <Button
            type="button"
            variant="signal"
            className="mt-2"
            disabled={busyId === "new"}
            onClick={() => void startListing()}
          >
            Start your first listing
          </Button>
        </div>
      ) : (
        <ul className="mt-8 divide-y divide-checkin-line overflow-hidden rounded-[1.1rem] border border-checkin-line bg-checkin-paper">
          {listings.map((listing) => (
            <ListingRow
              key={listing._id}
              listing={listing}
              busy={busyId === listing._id}
              canPublish={allowance.canPublishAnother}
              onPublish={() =>
                void run(
                  listing._id,
                  () =>
                    setStatus({ listingId: listing._id, status: "published" }),
                  "This listing isn't ready to publish yet. Open it to finish the remaining steps.",
                )
              }
              onUnpublish={() =>
                void run(
                  listing._id,
                  () => setStatus({ listingId: listing._id, status: "draft" }),
                  "Couldn't unpublish the listing.",
                )
              }
              onArchive={() =>
                confirmThen(
                  `Archive "${listing.title}"? It will stop taking bookings and can't be edited again. Existing reservations are kept.`,
                  () =>
                    void run(
                      listing._id,
                      () =>
                        setStatus({
                          listingId: listing._id,
                          status: "archived",
                        }),
                      "Couldn't archive the listing.",
                    ),
                )
              }
              onDelete={() =>
                confirmThen(
                  `Delete the draft "${listing.title}"? Its photos and calendar settings are removed permanently.`,
                  () =>
                    void run(
                      listing._id,
                      () => deleteDraft({ listingId: listing._id }),
                      "Couldn't delete the draft.",
                    ),
                )
              }
            />
          ))}
        </ul>
      )}

      <BookingRequests />
    </main>
  );
}

function ListingRow({
  listing,
  busy,
  canPublish,
  onPublish,
  onUnpublish,
  onArchive,
  onDelete,
}: {
  listing: Doc<"listings">;
  busy: boolean;
  canPublish: boolean;
  onPublish: () => void;
  onUnpublish: () => void;
  onArchive: () => void;
  onDelete: () => void;
}) {
  const neverPublished = listing.status === "draft" && !listing.publishedAt;
  return (
    <li className="flex flex-wrap items-center justify-between gap-3 px-5 py-4">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <Link
            href={`/hosting/listings/${listing._id}`}
            className="truncate font-semibold hover:underline"
          >
            {listing.title || "Untitled draft"}
          </Link>
          <ListingStatusBadge listing={listing} />
        </div>
        <p className="text-sm text-checkin-muted">
          {listing.publicLocation.city || "No location yet"} ·{" "}
          {listing.nightlyPriceCents
            ? `${formatNightlyPrice(listing.nightlyPriceCents)} night`
            : "No price yet"}
        </p>
      </div>
      <div className="flex flex-wrap items-center gap-1">
        {listing.status !== "archived" ? (
          <Link
            href={`/hosting/listings/${listing._id}`}
            className={actionLink}
          >
            Edit
          </Link>
        ) : (
          <Link
            href={`/hosting/listings/${listing._id}?step=review`}
            className={actionLink}
          >
            View
          </Link>
        )}
        {listing.status === "draft" ? (
          <Button
            type="button"
            variant="quiet"
            size="sm"
            disabled={busy || !canPublish}
            title={
              canPublish
                ? undefined
                : "Your plan's publishing allowance is used up"
            }
            onClick={onPublish}
          >
            Publish
          </Button>
        ) : null}
        {listing.status === "published" ? (
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={busy}
            onClick={onUnpublish}
          >
            Unpublish
          </Button>
        ) : null}
        {listing.status !== "archived" && !neverPublished ? (
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={busy}
            onClick={onArchive}
          >
            Archive
          </Button>
        ) : null}
        {neverPublished ? (
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={busy}
            onClick={onDelete}
          >
            Delete draft
          </Button>
        ) : null}
      </div>
    </li>
  );
}
