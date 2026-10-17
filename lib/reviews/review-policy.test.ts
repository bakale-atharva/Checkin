import assert from "node:assert/strict";
import test from "node:test";

import {
  areValidRatings,
  GUEST_RATING_KEYS,
  HOST_RATING_KEYS,
  isValidRating,
  REVIEW_WINDOW_MS,
  shouldRevealReviews,
} from "./review-policy";

test("reveals two-way reviews as soon as both participants submit", () => {
  assert.equal(
    shouldRevealReviews({
      now: Date.UTC(2026, 9, 16),
      reviewDeadlineAt: Date.UTC(2026, 9, 30),
      submittedReviews: 2,
    }),
    true,
  );
});

test("keeps a one-sided review private before the deadline", () => {
  assert.equal(
    shouldRevealReviews({
      now: Date.UTC(2026, 9, 16),
      reviewDeadlineAt: Date.UTC(2026, 9, 30),
      submittedReviews: 1,
    }),
    false,
  );
});

test("reveals a one-sided review when the 14-day window closes", () => {
  const checkOutAt = Date.UTC(2026, 9, 2, 11);
  assert.equal(REVIEW_WINDOW_MS, 14 * 24 * 60 * 60 * 1000);
  assert.equal(
    shouldRevealReviews({
      now: checkOutAt + REVIEW_WINDOW_MS,
      reviewDeadlineAt: checkOutAt + REVIEW_WINDOW_MS,
      submittedReviews: 1,
    }),
    true,
  );
});

test("accepts only whole-number ratings from one through five", () => {
  assert.equal(isValidRating(1), true);
  assert.equal(isValidRating(5), true);
  assert.equal(isValidRating(0), false);
  assert.equal(isValidRating(6), false);
  assert.equal(isValidRating(4.5), false);
});

test("requires every role-specific rating category", () => {
  const guest = {
    overall: 5,
    cleanliness: 4,
    accuracy: 5,
    checkIn: 5,
    communication: 5,
    location: 4,
    value: 4,
  };
  assert.equal(areValidRatings(guest, GUEST_RATING_KEYS), true);
  assert.equal(
    areValidRatings({ ...guest, value: 0 }, GUEST_RATING_KEYS),
    false,
  );
  assert.equal(
    areValidRatings({ communication: 5, cleanliness: 5 }, HOST_RATING_KEYS),
    false,
  );
  assert.equal(
    areValidRatings(
      { communication: 5, cleanliness: 5, ruleObservance: 3 },
      HOST_RATING_KEYS,
    ),
    true,
  );
});
