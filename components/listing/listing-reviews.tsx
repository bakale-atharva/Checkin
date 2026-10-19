"use client";

import { usePaginatedQuery } from "convex/react";
import { Star } from "lucide-react";

import { Button } from "@/components/ui/button";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";

export type ReviewSummary = {
  count: number;
  overall: number;
  cleanliness: number;
  accuracy: number;
  checkIn: number;
  communication: number;
  location: number;
  value: number;
};

type PublishedReview = {
  id: Id<"reviews">;
  guestRatings?: { overall: number };
  comment?: string;
  submittedAt: number;
};

const categories = [
  ["cleanliness", "Cleanliness"],
  ["accuracy", "Accuracy"],
  ["checkIn", "Check-in"],
  ["communication", "Communication"],
  ["location", "Location"],
  ["value", "Value"],
] as const;

const reviewMonth = new Intl.DateTimeFormat("en-US", {
  month: "long",
  year: "numeric",
});

/** Revealed guest reviews only; reviews stay hidden until both sides submit or the window closes. */
export function ListingReviews({
  listingId,
  summary,
}: {
  listingId: Id<"listings">;
  summary: ReviewSummary | null;
}) {
  const { results, status, loadMore } = usePaginatedQuery(
    api.dashboard.publishedReviews,
    { listingId },
    { initialNumItems: 6 },
  );
  const reviews = results as PublishedReview[];

  return (
    <section aria-labelledby="reviews-heading" className="py-10">
      <h2
        id="reviews-heading"
        className="flex items-center gap-2 text-2xl font-semibold tracking-[-0.03em]"
      >
        <Star aria-hidden className="size-5 fill-checkin-ink" />
        {summary
          ? `${summary.overall.toFixed(2)} · ${summary.count} ${summary.count === 1 ? "review" : "reviews"}`
          : "No reviews yet"}
      </h2>
      {summary ? (
        <dl className="mt-6 grid gap-x-10 gap-y-3 sm:grid-cols-2 lg:grid-cols-3">
          {categories.map(([key, label]) => (
            <div key={key} className="flex items-center gap-3 text-sm">
              <dt className="w-32 shrink-0">{label}</dt>
              <dd className="flex flex-1 items-center gap-3">
                <span
                  aria-hidden
                  className="h-1 flex-1 overflow-hidden rounded-full bg-checkin-line"
                >
                  <span
                    className="block h-full rounded-full bg-checkin-ink"
                    style={{ width: `${(summary[key] / 5) * 100}%` }}
                  />
                </span>
                <span className="w-8 text-right tabular-nums">
                  {summary[key].toFixed(1)}
                </span>
              </dd>
            </div>
          ))}
        </dl>
      ) : (
        <p className="mt-2 text-sm text-checkin-muted">
          Reviews appear once a guest and host have both reviewed a completed
          stay, or 14 days after checkout.
        </p>
      )}

      {reviews.length > 0 ? (
        <ul className="mt-8 grid gap-8 md:grid-cols-2">
          {reviews.map((review) => (
            <li key={review.id}>
              <p className="flex items-center gap-2 text-sm">
                <span className="inline-flex items-center gap-1 font-semibold">
                  <Star aria-hidden className="size-3.5 fill-checkin-ink" />
                  <span className="sr-only">Rated</span>
                  {review.guestRatings?.overall ?? "–"}
                </span>
                <span className="text-checkin-muted">
                  · {reviewMonth.format(review.submittedAt)}
                </span>
              </p>
              <p className="mt-2 leading-relaxed">
                {review.comment?.trim() || (
                  <span className="text-checkin-muted">
                    The guest left a rating without a comment.
                  </span>
                )}
              </p>
            </li>
          ))}
        </ul>
      ) : null}
      {status === "CanLoadMore" ? (
        <Button
          type="button"
          variant="outline"
          className="mt-8"
          onClick={() => loadMore(6)}
        >
          Show more reviews
        </Button>
      ) : null}
    </section>
  );
}
