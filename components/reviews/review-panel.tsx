"use client";

import { useMutation, useQuery } from "convex/react";
import { CheckCircle2, Clock, EyeOff, Star } from "lucide-react";
import { useState, type FormEvent } from "react";

import { errorMessage } from "@/components/hosting/form-controls";
import { Button } from "@/components/ui/button";
import { Surface } from "@/components/ui/surface";
import { useProfileReady } from "@/components/use-profile-ready";
import { api } from "@/convex/_generated/api";
import type { Doc, Id } from "@/convex/_generated/dataModel";
import {
  GUEST_RATING_KEYS,
  HOST_RATING_KEYS,
} from "@/lib/reviews/review-policy";
import { daysLeft, reviewPhase } from "@/lib/reviews/review-phase";
import { cn } from "@/lib/utils";

type ReviewStatus = {
  eligible: boolean;
  status: Doc<"reservations">["status"];
  listingTitle: string | null;
  counterpartFirstName: string | null;
  checkIn: string;
  checkOut: string;
  role: "guest" | "host";
  reviewDeadlineAt: number;
  mine: Doc<"reviews"> | null;
  counterpartSubmitted: boolean;
  counterpart: Doc<"reviews"> | null;
};

type GuestRatings = Record<(typeof GUEST_RATING_KEYS)[number], number>;
type HostRatings = Record<(typeof HOST_RATING_KEYS)[number], number>;

const MAX_COMMENT_LENGTH = 2_000;
const countFormat = new Intl.NumberFormat("en-US");

const RATING_LABELS: Record<string, string> = {
  overall: "Overall experience",
  cleanliness: "Cleanliness",
  accuracy: "Accuracy",
  checkIn: "Check-in",
  communication: "Communication",
  location: "Location",
  value: "Value",
  ruleObservance: "Rule observance",
};

const RATING_HINTS: Record<string, string> = {
  accuracy: "How closely the stay matched the listing.",
  ruleObservance: "Whether the guest followed the house rules.",
};

const deadlineFormat = new Intl.DateTimeFormat("en-US", {
  weekday: "short",
  month: "short",
  day: "numeric",
  hour: "numeric",
  minute: "2-digit",
});

export function ReviewPanel({
  reservationId,
}: {
  reservationId: Id<"reservations">;
}) {
  const profileReady = useProfileReady();
  const review = useQuery(
    api.dashboard.reservationReviewStatus,
    profileReady ? { reservationId } : "skip",
  ) as ReviewStatus | undefined;
  const [now] = useState(() => Date.now());

  if (review === undefined)
    return (
      <p role="status" className="text-sm text-checkin-muted">
        Loading review…
      </p>
    );

  const phase = reviewPhase({
    eligible: review.eligible,
    now,
    reviewDeadlineAt: review.reviewDeadlineAt,
    mineSubmitted: review.mine !== null,
    mineRevealed: review.mine?.revealedAt !== undefined,
  });
  const counterpart =
    review.counterpartFirstName ??
    (review.role === "guest" ? "your host" : "your guest");
  const deadline = deadlineFormat.format(new Date(review.reviewDeadlineAt));

  if (phase === "not_eligible")
    return (
      <Notice icon={<Clock aria-hidden className="size-4" />}>
        Reviews open after checkout. Once the stay is complete you and{" "}
        {counterpart} each have 14 days to review each other.
      </Notice>
    );

  if (phase === "closed")
    return (
      <Notice icon={<Clock aria-hidden className="size-4" />}>
        The review window closed on {deadline}.{" "}
        {review.counterpart
          ? `Here's what ${counterpart} wrote.`
          : "No review was left for this stay."}
        {review.counterpart ? (
          <SubmittedReview review={review.counterpart} className="mt-3" />
        ) : null}
      </Notice>
    );

  if (phase === "awaiting_counterpart")
    return (
      <div className="space-y-4">
        <Notice icon={<EyeOff aria-hidden className="size-4" />}>
          <strong className="font-semibold">Review submitted.</strong> It stays
          hidden until {counterpart} submits theirs or the window closes on{" "}
          {deadline} — then both publish at the same time, so neither of you can
          see the other&apos;s before writing.
        </Notice>
        {review.mine ? (
          <SubmittedReview review={review.mine} heading="Your review" />
        ) : null}
      </div>
    );

  if (phase === "revealed")
    return (
      <div className="space-y-4">
        <Notice icon={<CheckCircle2 aria-hidden className="size-4" />}>
          Reviews are published.
          {review.role === "guest"
            ? " Your ratings now count toward the listing's score."
            : ""}
        </Notice>
        {review.mine ? (
          <SubmittedReview review={review.mine} heading="Your review" />
        ) : null}
        {review.counterpart ? (
          <SubmittedReview
            review={review.counterpart}
            heading={`${counterpart}'s review`}
          />
        ) : (
          <p className="text-sm text-checkin-muted">
            {counterpart} didn&apos;t leave a review before the window closed.
          </p>
        )}
      </div>
    );

  return (
    <ReviewForm
      reservationId={reservationId}
      role={review.role}
      counterpart={counterpart}
      deadline={deadline}
      days={daysLeft(now, review.reviewDeadlineAt)}
      counterpartSubmitted={review.counterpartSubmitted}
    />
  );
}

function ReviewForm({
  reservationId,
  role,
  counterpart,
  deadline,
  days,
  counterpartSubmitted,
}: {
  reservationId: Id<"reservations">;
  role: "guest" | "host";
  counterpart: string;
  deadline: string;
  days: number;
  counterpartSubmitted: boolean;
}) {
  const submitReview = useMutation(api.dashboard.submitReview);
  const keys: readonly string[] =
    role === "guest" ? GUEST_RATING_KEYS : HOST_RATING_KEYS;
  const [ratings, setRatings] = useState<Record<string, number>>({});
  const [comment, setComment] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const missing = keys.filter((key) => !ratings[key]);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (missing.length > 0) {
      setError(
        `Rate ${missing.map((key) => RATING_LABELS[key].toLowerCase()).join(", ")} to submit.`,
      );
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const picked = Object.fromEntries(keys.map((key) => [key, ratings[key]]));
      await submitReview({
        reservationId,
        ...(role === "guest"
          ? { guestRatings: picked as GuestRatings }
          : { hostRatings: picked as HostRatings }),
        ...(comment.trim() ? { comment: comment.trim() } : {}),
      });
    } catch (caught) {
      setError(errorMessage(caught, "Couldn't submit your review. Try again."));
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-6" noValidate>
      <Notice icon={<Clock aria-hidden className="size-4" />}>
        <strong className="font-semibold">
          {days === 1 ? "1 day" : `${days} days`} left
        </strong>{" "}
        — review by {deadline}. Your review stays hidden until {counterpart}{" "}
        also submits or the window closes, then both publish together. You
        can&apos;t edit it after submitting.
        {counterpartSubmitted
          ? ` ${counterpart} has already submitted, so yours publishes as soon as you send it.`
          : ""}
      </Notice>

      <div className="grid gap-x-8 gap-y-5 sm:grid-cols-2">
        {keys.map((key) => (
          <StarRating
            key={key}
            id={`rating-${key}`}
            label={RATING_LABELS[key]}
            hint={RATING_HINTS[key]}
            value={ratings[key] ?? 0}
            onChange={(value) =>
              setRatings((current) => ({ ...current, [key]: value }))
            }
          />
        ))}
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="review-comment" className="text-sm font-semibold">
          {role === "guest"
            ? "Tell future guests about your stay"
            : `How was hosting ${counterpart}?`}{" "}
          <span className="font-normal text-checkin-muted">(optional)</span>
        </label>
        <textarea
          id="review-comment"
          value={comment}
          maxLength={MAX_COMMENT_LENGTH}
          onChange={(event) => setComment(event.target.value)}
          aria-describedby="review-comment-count"
          className="min-h-32 w-full rounded-[0.7rem] border border-checkin-line bg-checkin-paper px-3 py-2.5 text-sm leading-relaxed focus-visible:border-checkin-ink focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-checkin-signal/25"
        />
        <p id="review-comment-count" className="text-xs text-checkin-muted">
          {countFormat.format(comment.length)} /{" "}
          {countFormat.format(MAX_COMMENT_LENGTH)} characters
        </p>
      </div>

      {error ? (
        <p role="alert" className="text-sm font-medium text-checkin-signal">
          {error}
        </p>
      ) : null}
      <Button type="submit" disabled={submitting}>
        {submitting ? "Submitting…" : "Submit review"}
      </Button>
    </form>
  );
}

function StarRating({
  id,
  label,
  hint,
  value,
  onChange,
}: {
  id: string;
  label: string;
  hint?: string;
  value: number;
  onChange: (value: number) => void;
}) {
  return (
    <fieldset aria-describedby={hint ? `${id}-hint` : undefined}>
      <legend className="text-sm font-semibold">{label}</legend>
      {hint ? (
        <p id={`${id}-hint`} className="text-xs text-checkin-muted">
          {hint}
        </p>
      ) : null}
      <div className="mt-1 flex">
        {[1, 2, 3, 4, 5].map((star) => (
          <label
            key={star}
            className="group grid size-11 cursor-pointer place-items-center rounded-full has-[:focus-visible]:ring-3 has-[:focus-visible]:ring-checkin-signal/35"
          >
            <input
              type="radio"
              name={id}
              value={star}
              checked={value === star}
              onChange={() => onChange(star)}
              className="sr-only"
            />
            <span className="sr-only">
              {star} {star === 1 ? "star" : "stars"}
            </span>
            <Star
              aria-hidden
              className={cn(
                "size-6 transition-colors motion-reduce:transition-none",
                star <= value
                  ? "fill-checkin-signal text-checkin-signal"
                  : "text-checkin-line group-hover:text-checkin-muted",
              )}
            />
          </label>
        ))}
      </div>
    </fieldset>
  );
}

function SubmittedReview({
  review,
  heading,
  className,
}: {
  review: Doc<"reviews">;
  heading?: string;
  className?: string;
}) {
  const ratings: Record<string, number> = {
    ...(review.guestRatings ?? {}),
    ...(review.hostRatings ?? {}),
  };
  return (
    <Surface className={cn("p-5", className)}>
      {heading ? <h3 className="font-semibold">{heading}</h3> : null}
      <dl className="mt-2 grid grid-cols-2 gap-x-6 gap-y-1 text-sm sm:grid-cols-3">
        {Object.entries(ratings).map(([key, rating]) => (
          <div key={key} className="flex justify-between gap-2">
            <dt className="text-checkin-muted">{RATING_LABELS[key] ?? key}</dt>
            <dd className="font-semibold tabular-nums">
              {rating}
              <span className="sr-only"> out of 5</span>
            </dd>
          </div>
        ))}
      </dl>
      {review.comment ? (
        <p className="mt-3 text-sm leading-relaxed whitespace-pre-wrap">
          {review.comment}
        </p>
      ) : null}
    </Surface>
  );
}

function Notice({
  icon,
  children,
}: {
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="flex gap-3 rounded-[0.9rem] border border-checkin-line px-4 py-3 text-sm leading-relaxed">
      <span className="mt-0.5 shrink-0">{icon}</span>
      <div>{children}</div>
    </div>
  );
}
