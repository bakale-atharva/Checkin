import assert from "node:assert/strict";
import test from "node:test";

import {
  isConversationUnread,
  MESSAGE_RATE_LIMIT,
  MESSAGE_RATE_WINDOW_MS,
  nextMessageRateLimit,
} from "./message-policy";

test("starts a new message-rate window for a sender", () => {
  assert.deepEqual(nextMessageRateLimit(null, 10_000), {
    windowStartedAt: 10_000,
    sentCount: 1,
  });
});

test("increments a sender within the active rate window", () => {
  assert.deepEqual(
    nextMessageRateLimit({ windowStartedAt: 10_000, sentCount: 2 }, 10_001),
    { windowStartedAt: 10_000, sentCount: 3 },
  );
});

test("rejects a sender after the per-minute message limit", () => {
  assert.throws(
    () =>
      nextMessageRateLimit(
        { windowStartedAt: 10_000, sentCount: MESSAGE_RATE_LIMIT },
        10_001,
      ),
    /rate limit/i,
  );
});

test("resets the count when the rate window ends", () => {
  assert.deepEqual(
    nextMessageRateLimit(
      { windowStartedAt: 10_000, sentCount: MESSAGE_RATE_LIMIT },
      10_000 + MESSAGE_RATE_WINDOW_MS,
    ),
    { windowStartedAt: 10_000 + MESSAGE_RATE_WINDOW_MS, sentCount: 1 },
  );
});

test("marks a conversation unread only when a message is newer than the read position", () => {
  assert.equal(isConversationUnread(undefined, undefined), false);
  assert.equal(isConversationUnread(20, undefined), true);
  assert.equal(isConversationUnread(20, 20), false);
  assert.equal(isConversationUnread(20, 30), false);
  assert.equal(isConversationUnread(31, 30), true);
});
