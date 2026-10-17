export const REVIEW_WINDOW_MS = 14 * 24 * 60 * 60 * 1000;

export const GUEST_RATING_KEYS = [
  "overall",
  "cleanliness",
  "accuracy",
  "checkIn",
  "communication",
  "location",
  "value",
] as const;

export const HOST_RATING_KEYS = [
  "communication",
  "cleanliness",
  "ruleObservance",
] as const;

export function shouldRevealReviews({
  now,
  reviewDeadlineAt,
  submittedReviews,
}: {
  now: number;
  reviewDeadlineAt: number;
  submittedReviews: number;
}) {
  return submittedReviews === 2 || now >= reviewDeadlineAt;
}

export function isValidRating(value: number) {
  return Number.isInteger(value) && value >= 1 && value <= 5;
}

export function areValidRatings(
  ratings: Record<string, number>,
  keys: readonly string[],
) {
  return keys.every((key) => isValidRating(ratings[key]));
}
