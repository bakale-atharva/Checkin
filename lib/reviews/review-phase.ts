export type ReviewPhase =
  "not_eligible" | "open" | "awaiting_counterpart" | "revealed" | "closed";

/**
 * Where a participant stands in the two-way review flow. Reviews stay hidden
 * until both participants submit or the 14-day window closes.
 */
export function reviewPhase({
  eligible,
  now,
  reviewDeadlineAt,
  mineSubmitted,
  mineRevealed,
}: {
  eligible: boolean;
  now: number;
  reviewDeadlineAt: number;
  mineSubmitted: boolean;
  mineRevealed: boolean;
}): ReviewPhase {
  if (!eligible) return "not_eligible";
  if (mineSubmitted) return mineRevealed ? "revealed" : "awaiting_counterpart";
  return now < reviewDeadlineAt ? "open" : "closed";
}

/** Whole days left before the deadline, rounded up so "less than a day" reads as 1. */
export function daysLeft(now: number, deadline: number) {
  return Math.max(0, Math.ceil((deadline - now) / 86_400_000));
}
