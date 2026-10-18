"use client";

import { Star, Zap } from "lucide-react";
import Link from "next/link";

import { PropertyFrame } from "@/components/ui/property-frame";
import {
  formatNightlyPrice,
  propertyTypeLabels,
} from "@/lib/discovery/catalog";
import { cn } from "@/lib/utils";
import type { SearchResult } from "./use-search-results";
import { ListingPhoto } from "./listing-photo";
import { WishlistButton } from "./wishlist-button";

export function ListingCard({
  listing,
  href,
  saved,
  active,
  preload,
  onHoverChange,
}: {
  listing: SearchResult;
  href: string;
  saved: boolean;
  active: boolean;
  preload?: boolean;
  onHoverChange: (hovered: boolean) => void;
}) {
  const place = [listing.city, listing.region ?? listing.countryCode]
    .filter(Boolean)
    .join(", ");
  const rating = listing.publishedRating;

  return (
    <PropertyFrame
      id={`listing-${listing.listingId}`}
      onPointerEnter={() => onHoverChange(true)}
      onPointerLeave={() => onHoverChange(false)}
      onFocus={() => onHoverChange(true)}
      onBlur={() => onHoverChange(false)}
      className={cn(
        "group relative bg-transparent transition-shadow",
        active &&
          "ring-2 ring-checkin-ink ring-offset-4 ring-offset-checkin-canvas",
      )}
    >
      <div className="relative aspect-[20/19] overflow-hidden rounded-[1.1rem] bg-checkin-mist">
        <ListingPhoto
          src={listing.coverPhotoUrl}
          alt={listing.coverPhotoAlt ?? listing.title}
          sizes="(min-width: 1280px) 22vw, (min-width: 768px) 33vw, 100vw"
          preload={preload}
          className="transition-transform duration-500 group-hover:scale-[1.03] motion-reduce:transition-none"
        />
        {listing.bookingMode === "instant" ? (
          <span className="absolute left-3 top-3 inline-flex items-center gap-1 rounded-full bg-checkin-paper/90 px-2.5 py-1 text-xs font-semibold text-checkin-ink backdrop-blur">
            <Zap
              aria-hidden
              className="size-3 fill-checkin-signal text-checkin-signal"
            />
            Instant book
          </span>
        ) : null}
        <WishlistButton
          listingId={listing.listingId}
          listingTitle={listing.title}
          saved={saved}
          className="absolute right-2.5 top-2.5 z-10"
        />
      </div>
      <div className="space-y-0.5 px-0.5 pt-3">
        <div className="flex items-start justify-between gap-3">
          <h3 className="min-w-0 truncate font-semibold tracking-[-0.02em]">
            <Link
              href={href}
              className="after:absolute after:inset-0 after:rounded-[1.1rem] focus-visible:outline-none group-has-[a:focus-visible]:underline"
            >
              {place}
            </Link>
          </h3>
          <span className="inline-flex shrink-0 items-center gap-1 text-sm">
            {rating > 0 ? (
              <>
                <Star aria-hidden className="size-3.5 fill-checkin-ink" />
                <span className="sr-only">Rated</span>
                {rating.toFixed(2)}
              </>
            ) : (
              <span className="text-checkin-muted">New</span>
            )}
          </span>
        </div>
        <p className="truncate text-sm text-checkin-muted">{listing.title}</p>
        <p className="text-sm text-checkin-muted">
          {propertyTypeLabels[listing.propertyType]} · Up to {listing.maxGuests}{" "}
          {listing.maxGuests === 1 ? "guest" : "guests"}
        </p>
        <p className="pt-1 text-sm">
          <span className="font-semibold">
            {formatNightlyPrice(listing.nightlyPriceCents)}
          </span>{" "}
          <span className="text-checkin-muted">night</span>
        </p>
      </div>
    </PropertyFrame>
  );
}
