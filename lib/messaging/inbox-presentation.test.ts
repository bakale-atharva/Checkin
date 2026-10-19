import assert from "node:assert/strict";
import test from "node:test";

import {
  badgeCount,
  dayLabel,
  firstUnreadIndex,
  groupMessagesByDay,
  notificationCopy,
  notificationHref,
  reservationHref,
  type ReservationContext,
} from "./inbox-presentation";

const guestContext: ReservationContext = {
  reservationId: "res_1",
  role: "guest",
  status: "confirmed",
  listingTitle: "Cliffside cabin",
  checkIn: "2026-11-01",
  checkOut: "2026-11-03",
};
const hostContext: ReservationContext = { ...guestContext, role: "host" };

test("links guests to their trip and hosts to their calendar", () => {
  assert.equal(reservationHref(guestContext), "/trips/res_1");
  assert.equal(reservationHref(hostContext), "/hosting/calendar");
});

test("routes each notification kind to its context", () => {
  assert.equal(
    notificationHref({
      kind: "message",
      conversationId: "conv_1",
      context: guestContext,
    }),
    "/inbox/conv_1",
  );
  assert.equal(
    notificationHref({ kind: "review_eligible", context: hostContext }),
    "/reviews/res_1",
  );
  assert.equal(
    notificationHref({ kind: "reservation_action", context: guestContext }),
    "/trips/res_1",
  );
  assert.equal(
    notificationHref({ kind: "reservation_action", context: null }),
    null,
  );
});

test("describes reservation updates with the listing and status", () => {
  assert.deepEqual(
    notificationCopy({ kind: "reservation_action", context: guestContext }),
    {
      title: "Reservation updated",
      body: "Cliffside cabin is now confirmed.",
    },
  );
  assert.match(
    notificationCopy({ kind: "review_eligible", context: null }).body,
    /14 days to review your stay/,
  );
});

test("caps badge counts and marks truncated scans", () => {
  assert.equal(badgeCount(0, false), null);
  assert.equal(badgeCount(4, false), "4");
  assert.equal(badgeCount(12, true), "12+");
  assert.equal(badgeCount(140, false), "99+");
});

test("finds the first unread message from the other participant", () => {
  const messages = [
    { createdAt: 10, senderProfileId: "host" },
    { createdAt: 20, senderProfileId: "guest" },
    { createdAt: 30, senderProfileId: "host" },
  ];
  assert.equal(firstUnreadIndex(messages, 15, "guest"), 2);
  assert.equal(firstUnreadIndex(messages, null, "guest"), 0);
  assert.equal(firstUnreadIndex(messages, 30, "guest"), -1);
  // The viewer's own messages never count as unread.
  assert.equal(firstUnreadIndex(messages, 15, "host"), 1);
});

test("groups messages by calendar day in the given timezone", () => {
  const groups = groupMessagesByDay(
    [
      { createdAt: Date.parse("2026-10-18T23:30:00Z") },
      { createdAt: Date.parse("2026-10-19T00:30:00Z") },
      { createdAt: Date.parse("2026-10-19T09:00:00Z") },
    ],
    "UTC",
  );
  assert.deepEqual(
    groups.map((group) => [group.day, group.messages.length]),
    [
      ["2026-10-18", 1],
      ["2026-10-19", 2],
    ],
  );
  // The same instants fall on one day in New York.
  assert.equal(
    groupMessagesByDay(
      [
        { createdAt: Date.parse("2026-10-18T23:30:00Z") },
        { createdAt: Date.parse("2026-10-19T00:30:00Z") },
      ],
      "America/New_York",
    ).length,
    1,
  );
});

test("labels today, yesterday, and older days", () => {
  const now = Date.parse("2026-10-19T12:00:00Z");
  assert.equal(dayLabel("2026-10-19", now, "UTC"), "Today");
  assert.equal(dayLabel("2026-10-18", now, "UTC"), "Yesterday");
  assert.equal(dayLabel("2026-10-12", now, "UTC"), "Mon, Oct 12");
});
