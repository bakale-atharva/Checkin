"use client";

import { useConvexAuth, useQuery } from "convex/react";
import { House } from "lucide-react";

import { api } from "@/convex/_generated/api";
import { formatNightlyPrice } from "@/lib/discovery/catalog";
import { cn } from "@/lib/utils";

const statusStyles = {
  published: "bg-checkin-mist text-checkin-ink",
  draft: "bg-checkin-paper text-checkin-muted border border-checkin-line",
  archived: "bg-checkin-line/60 text-checkin-muted",
} as const;

export default function HostingPage() {
  const { isAuthenticated } = useConvexAuth();
  const listings = useQuery(
    api.listings.myListings,
    isAuthenticated ? {} : "skip",
  );

  return (
    <main className="mx-auto w-full max-w-[90rem] flex-1 px-4 py-10 sm:px-6 lg:px-8">
      <h1 className="text-3xl font-semibold tracking-[-0.05em]">
        Your properties
      </h1>
      <p className="mt-1 text-checkin-muted">
        Drafts, published stays, and archived properties on this account.
      </p>

      {listings === undefined ? (
        <p className="mt-10 text-checkin-muted">Loading properties…</p>
      ) : listings.length === 0 ? (
        <div className="mt-10 flex flex-col items-center gap-3 rounded-[1.25rem] border border-dashed border-checkin-line px-6 py-16 text-center">
          <House aria-hidden className="size-7 text-checkin-muted" />
          <p className="font-semibold">
            You haven&apos;t listed a property yet
          </p>
          <p className="max-w-sm text-sm text-checkin-muted">
            Free hosts can publish one property; Host Pro raises that to ten.
          </p>
        </div>
      ) : (
        <ul className="mt-8 divide-y divide-checkin-line overflow-hidden rounded-[1.1rem] border border-checkin-line bg-checkin-paper">
          {listings.map((listing) => (
            <li
              key={listing._id}
              className="flex flex-wrap items-center justify-between gap-3 px-5 py-4"
            >
              <div className="min-w-0">
                <p className="truncate font-semibold">
                  {listing.title || "Untitled draft"}
                </p>
                <p className="text-sm text-checkin-muted">
                  {listing.publicLocation.city || "No location yet"} ·{" "}
                  {formatNightlyPrice(listing.nightlyPriceCents)} night
                </p>
              </div>
              <span
                className={cn(
                  "rounded-full px-3 py-1 text-xs font-semibold capitalize",
                  statusStyles[listing.status],
                )}
              >
                {listing.bookingSuspended ? "Suspended" : listing.status}
              </span>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
