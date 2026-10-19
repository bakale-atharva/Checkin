"use client";

import {
  useConvexAuth,
  useMutation,
  usePaginatedQuery,
  useQuery,
} from "convex/react";
import { ArrowLeft, Trash2 } from "lucide-react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";

import { ListingPhoto } from "@/components/discovery/listing-photo";
import { Button } from "@/components/ui/button";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { formatNightlyPrice } from "@/lib/discovery/catalog";

type WishlistItem = {
  _id: Id<"wishlistItems">;
  listing: {
    id: Id<"listings">;
    title: string;
    city: string;
    region?: string;
    nightlyPriceCents: number;
    coverPhotoUrl: string | null;
  };
};

export function WishlistDetail() {
  const { wishlistId } = useParams<{ wishlistId: string }>();
  const id = wishlistId as Id<"wishlists">;
  const router = useRouter();
  const { isAuthenticated } = useConvexAuth();
  const wishlists = useQuery(
    api.dashboard.listWishlists,
    isAuthenticated ? {} : "skip",
  ) as Array<{ _id: Id<"wishlists">; name: string }> | undefined;
  const wishlist = wishlists?.find((candidate) => candidate._id === id);
  const items = usePaginatedQuery(
    api.dashboard.listWishlistItems,
    isAuthenticated && wishlist ? { wishlistId: id } : "skip",
    { initialNumItems: 24 },
  );
  const removeItem = useMutation(api.dashboard.removeWishlistItem);
  const deleteWishlist = useMutation(api.dashboard.deleteWishlist);

  if (wishlists !== undefined && !wishlist) {
    return (
      <main className="mx-auto w-full max-w-[90rem] flex-1 px-4 py-16 text-center sm:px-6 lg:px-8">
        <h1 className="text-2xl font-semibold tracking-[-0.04em]">
          Wishlist not found
        </h1>
        <p className="mt-2 text-checkin-muted">It may have been deleted.</p>
        <Link
          href="/wishlists"
          className="mt-4 inline-block font-semibold underline underline-offset-4"
        >
          Back to wishlists
        </Link>
      </main>
    );
  }

  const results = items.results as WishlistItem[];

  return (
    <main className="mx-auto w-full max-w-[90rem] flex-1 px-4 py-10 sm:px-6 lg:px-8">
      <Link
        href="/wishlists"
        className="inline-flex min-h-10 items-center gap-2 text-sm font-semibold text-checkin-muted hover:text-checkin-ink"
      >
        <ArrowLeft aria-hidden className="size-4" /> Wishlists
      </Link>
      <div className="mt-2 flex flex-wrap items-end justify-between gap-4">
        <h1 className="text-3xl font-semibold tracking-[-0.05em]">
          {wishlist?.name ?? "Loading…"}
        </h1>
        {wishlist ? (
          <Button
            variant="outline"
            onClick={async () => {
              if (
                !window.confirm(
                  `Delete “${wishlist.name}”? Saved stays stay bookable.`,
                )
              )
                return;
              await deleteWishlist({ wishlistId: id });
              router.push("/wishlists");
            }}
          >
            <Trash2 aria-hidden className="size-4" /> Delete wishlist
          </Button>
        ) : null}
      </div>

      {items.status === "LoadingFirstPage" ? (
        <p className="mt-10 text-checkin-muted">Loading saved stays…</p>
      ) : results.length === 0 ? (
        <p className="mt-10 text-checkin-muted">
          Nothing saved here yet.{" "}
          <Link
            href="/"
            className="font-semibold text-checkin-ink underline underline-offset-4"
          >
            Browse stays
          </Link>
        </p>
      ) : (
        <ul className="mt-8 grid gap-x-5 gap-y-9 sm:grid-cols-2 lg:grid-cols-4">
          {results.map((item) => (
            <li key={item._id} className="group relative">
              <div className="relative aspect-[20/19] overflow-hidden rounded-[1.1rem] bg-checkin-mist">
                <ListingPhoto
                  src={item.listing.coverPhotoUrl}
                  alt={item.listing.title}
                  sizes="(min-width: 1024px) 25vw, (min-width: 640px) 50vw, 100vw"
                />
                <button
                  type="button"
                  aria-label={`Remove ${item.listing.title} from this wishlist`}
                  onClick={() =>
                    removeItem({ wishlistId: id, listingId: item.listing.id })
                  }
                  className="absolute right-2.5 top-2.5 z-10 grid size-11 place-items-center rounded-full bg-checkin-paper/90 shadow-[0_4px_14px_rgb(23_35_31/0.18)] hover:text-checkin-signal focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-checkin-signal/50"
                >
                  <Trash2 aria-hidden className="size-4" />
                </button>
              </div>
              <h2 className="mt-3 truncate font-semibold">
                <Link
                  href={`/listings/${item.listing.id}`}
                  className="after:absolute after:inset-0 focus-visible:underline focus-visible:outline-none"
                >
                  {[item.listing.city, item.listing.region]
                    .filter(Boolean)
                    .join(", ")}
                </Link>
              </h2>
              <p className="truncate text-sm text-checkin-muted">
                {item.listing.title}
              </p>
              <p className="pt-1 text-sm">
                <span className="font-semibold">
                  {formatNightlyPrice(item.listing.nightlyPriceCents)}
                </span>{" "}
                <span className="text-checkin-muted">night</span>
              </p>
            </li>
          ))}
        </ul>
      )}
      {items.status === "CanLoadMore" ? (
        <div className="mt-10 flex justify-center">
          <Button variant="outline" onClick={() => items.loadMore(24)}>
            Load more
          </Button>
        </div>
      ) : null}
    </main>
  );
}
