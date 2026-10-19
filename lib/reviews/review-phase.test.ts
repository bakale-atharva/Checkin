import assert from "node:assert/strict";
import test from "node:test";

import { daysLeft, reviewPhase } from "./review-phase";

const DAY = 86_400_000;
const base = {
  eligible: true,
  now: 0,
  reviewDeadlineAt: 14 * DAY,
  mineSubmitted: false,
  mineRevealed: false,
};

test("only completed stays can be reviewed", () => {
  assert.equal(reviewPhase({ ...base, eligible: false }), "not_eligible");
});

test("opens the form until the deadline, then closes it", () => {
  assert.equal(reviewPhase(base), "open");
  assert.equal(reviewPhase({ ...base, now: 14 * DAY }), "closed");
});

test("holds a submitted review until it is revealed", () => {
  assert.equal(
    reviewPhase({ ...base, mineSubmitted: true }),
    "awaiting_counterpart",
  );
  assert.equal(
    reviewPhase({ ...base, mineSubmitted: true, mineRevealed: true }),
    "revealed",
  );
});

test("rounds partial days up and never goes negative", () => {
  assert.equal(daysLeft(0, 14 * DAY), 14);
  assert.equal(daysLeft(0, DAY / 2), 1);
  assert.equal(daysLeft(2 * DAY, DAY), 0);
});
