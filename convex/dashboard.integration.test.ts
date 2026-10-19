import assert from "node:assert/strict";
import { after, before, describe, test } from "node:test";

import {
  createIntegrationHarness,
  errorCode,
  stayDates,
  type IntegrationHarness,
} from "../lib/testing/integration-harness";
import { api, internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";

const firstPage = { numItems: 20, cursor: null };
const guestRatings = {
  overall: 4,
  cleanliness: 5,
  accuracy: 4,
  checkIn: 5,
  communication: 5,
  location: 4,
  value: 4,
};
const hostRatings = { communication: 5, cleanliness: 5, ruleObservance: 5 };

describe("dashboards, messaging, and reviews against the test deployment", () => {
  let h: IntegrationHarness;
  let listingId: Id<"listings">;

  before(async () => {
    h = await createIntegrationHarness();
    listingId = (await h.publishListing((await h.as("host")).client))._id;
  });

  after(async () => {
    await h?.cleanup();
  });

  test("keeps reservation conversations private to their participants", async () => {
    const guest = await h.as("guest");
    const host = await h.as("host");
    const outsider = await h.as("outsider");
    const reservation = await h.book(guest.client, listingId, stayDates(30, 2));
    const conversationId = await guest.client.run(
      api.dashboard.getOrCreateReservationConversation,
      { reservationId: reservation._id },
    );
    assert.equal(
      await host.client.run(api.dashboard.getOrCreateReservationConversation, {
        reservationId: reservation._id,
      }),
      conversationId,
    );
    await host.client.run(api.dashboard.sendMessage, {
      conversationId,
      body: "Welcome!",
    });

    assert.equal(
      await errorCode(
        outsider.client.run(api.dashboard.conversationMessages, {
          conversationId,
          paginationOpts: firstPage,
        }),
      ),
      "CONVERSATION_FORBIDDEN",
    );
    assert.equal(
      await errorCode(
        outsider.client.run(api.dashboard.sendMessage, {
          conversationId,
          body: "hi",
        }),
      ),
      "CONVERSATION_FORBIDDEN",
    );
    assert.equal(
      await errorCode(
        outsider.client.run(api.dashboard.getOrCreateReservationConversation, {
          reservationId: reservation._id,
        }),
      ),
      "RESERVATION_FORBIDDEN",
    );
    assert.equal(
      (
        await outsider.client.run(api.dashboard.inbox, {
          paginationOpts: firstPage,
        })
      ).page.length,
      0,
    );
    const messages = await guest.client.run(
      api.dashboard.conversationMessages,
      { conversationId, paginationOpts: firstPage },
    );
    assert.deepEqual(
      messages.page.map((message) => message.body),
      ["Welcome!"],
    );
  });

  test("tracks unread positions per participant", async () => {
    const guest = await h.as("unreadguest");
    const host = await h.as("host");
    const reservation = await h.book(guest.client, listingId, stayDates(40, 2));
    const conversationId = await guest.client.run(
      api.dashboard.getOrCreateReservationConversation,
      { reservationId: reservation._id },
    );
    await host.client.run(api.dashboard.sendMessage, {
      conversationId,
      body: "Your door code arrives tomorrow.",
    });

    const guestInbox = await guest.client.run(api.dashboard.inbox, {
      paginationOpts: firstPage,
    });
    assert.equal(
      guestInbox.page.find((entry) => entry.conversationId === conversationId)
        ?.unread,
      true,
    );
    assert.equal(
      (await guest.client.run(api.dashboard.unreadSummary, {})).conversations,
      1,
    );

    await guest.client.run(api.dashboard.markConversationRead, {
      conversationId,
    });
    assert.equal(
      (await guest.client.run(api.dashboard.unreadSummary, {})).conversations,
      0,
    );

    await guest.client.run(api.dashboard.sendMessage, {
      conversationId,
      body: "Thanks!",
    });
    assert.equal(
      (await guest.client.run(api.dashboard.unreadSummary, {})).conversations,
      0,
    );
    const hostInbox = await host.client.run(api.dashboard.inbox, {
      paginationOpts: firstPage,
    });
    assert.equal(
      hostInbox.page.find((entry) => entry.conversationId === conversationId)
        ?.unread,
      true,
    );
  });

  test("rate-limits a sender after twenty messages a minute", async () => {
    const guest = await h.as("chatty");
    const reservation = await h.book(guest.client, listingId, stayDates(50, 2));
    const conversationId = await guest.client.run(
      api.dashboard.getOrCreateReservationConversation,
      { reservationId: reservation._id },
    );
    for (let index = 0; index < 20; index += 1) {
      await guest.client.run(api.dashboard.sendMessage, {
        conversationId,
        body: `message ${index}`,
      });
    }
    assert.equal(
      await errorCode(
        guest.client.run(api.dashboard.sendMessage, {
          conversationId,
          body: "one too many",
        }),
      ),
      "MESSAGE_RATE_LIMITED",
    );
  });

  test("keeps wishlists private to their owner", async () => {
    const guest = await h.as("wisher");
    const outsider = await h.as("outsider");
    const wishlistId = await guest.client.run(api.dashboard.createWishlist, {
      name: "Summer",
    });
    await guest.client.run(api.dashboard.addWishlistItem, {
      wishlistId,
      listingId,
    });
    await guest.client.run(api.dashboard.addWishlistItem, {
      wishlistId,
      listingId,
    });

    const items = await guest.client.run(api.dashboard.listWishlistItems, {
      wishlistId,
      paginationOpts: firstPage,
    });
    assert.equal(items.page.length, 1);
    assert.equal(
      await errorCode(
        outsider.client.run(api.dashboard.listWishlistItems, {
          wishlistId,
          paginationOpts: firstPage,
        }),
      ),
      "FORBIDDEN",
    );
    assert.equal(
      await errorCode(
        outsider.client.run(api.dashboard.renameWishlist, {
          wishlistId,
          name: "Mine",
        }),
      ),
      "FORBIDDEN",
    );
    assert.equal(
      (await outsider.client.run(api.dashboard.listWishlists, {})).length,
      0,
    );

    assert.deepEqual(
      await guest.client.run(api.dashboard.savedListingIds, {
        listingIds: [listingId],
      }),
      [listingId],
    );
    assert.deepEqual(
      await outsider.client.run(api.dashboard.savedListingIds, {
        listingIds: [listingId],
      }),
      [],
    );
    const memberships = await guest.client.run(api.dashboard.listingWishlists, {
      listingId,
    });
    assert.deepEqual(
      memberships.map((wishlist) => wishlist.containsListing),
      [true],
    );
    assert.equal(
      (await outsider.client.run(api.dashboard.listingWishlists, { listingId }))
        .length,
      0,
    );
  });

  test("hides a one-sided review until both submit, then publishes the aggregate", async () => {
    const guest = await h.as("reviewer");
    const host = await h.as("host");
    const outsider = await h.as("outsider");
    const reservation = await h.bookAndPay(
      guest.client,
      listingId,
      stayDates(60, 2),
    );
    await h.completeStay(reservation._id);

    await guest.client.run(api.dashboard.submitReview, {
      reservationId: reservation._id,
      guestRatings,
      comment: "Lovely.",
    });
    assert.equal(
      (
        await host.client.run(api.dashboard.publishedReviews, {
          listingId,
          paginationOpts: firstPage,
        })
      ).page.length,
      0,
    );
    const hostView = await host.client.run(
      api.dashboard.reservationReviewStatus,
      { reservationId: reservation._id },
    );
    assert.equal(hostView.counterpartSubmitted, true);
    assert.equal(hostView.counterpart, null);
    assert.equal(
      (await host.client.run(api.listings.myListings, {})).find(
        (listing) => listing._id === listingId,
      )?.publishedRating,
      undefined,
    );
    assert.equal(
      await errorCode(
        outsider.client.run(api.dashboard.reservationReviewStatus, {
          reservationId: reservation._id,
        }),
      ),
      "RESERVATION_FORBIDDEN",
    );
    assert.equal(
      await errorCode(
        outsider.client.run(api.dashboard.submitReview, {
          reservationId: reservation._id,
          guestRatings,
        }),
      ),
      "REVIEW_FORBIDDEN",
    );
    assert.equal(
      await errorCode(
        guest.client.run(api.dashboard.submitReview, {
          reservationId: reservation._id,
          guestRatings,
        }),
      ),
      "REVIEW_ALREADY_SUBMITTED",
    );

    await host.client.run(api.dashboard.submitReview, {
      reservationId: reservation._id,
      hostRatings,
    });
    const published = await outsider.client.run(
      api.dashboard.publishedReviews,
      { listingId, paginationOpts: firstPage },
    );
    assert.equal(published.page.length, 1);
    assert.equal(published.page[0].comment, "Lovely.");
    assert.equal(
      (await host.client.run(api.listings.myListings, {})).find(
        (listing) => listing._id === listingId,
      )?.publishedRating,
      4,
    );
    assert.notEqual(
      (
        await guest.client.run(api.dashboard.reservationReviewStatus, {
          reservationId: reservation._id,
        })
      ).counterpart,
      null,
    );
  });

  test("reveals a one-sided review when the 14-day window closes", async () => {
    const guest = await h.as("latereviewer");
    const host = await h.as("host");
    const reservation = await h.bookAndPay(
      guest.client,
      listingId,
      stayDates(70, 2),
    );
    await h.completeStay(reservation._id);
    await guest.client.run(api.dashboard.submitReview, {
      reservationId: reservation._id,
      guestRatings: { ...guestRatings, overall: 2 },
    });

    await h.admin.run(internal.testing.shiftReservationTimes, {
      reservationId: reservation._id,
      checkOutAt: new Date(Date.now() - 15 * 24 * 60 * 60 * 1000).toISOString(),
    });
    assert.equal(
      await errorCode(
        host.client.run(api.dashboard.submitReview, {
          reservationId: reservation._id,
          hostRatings,
        }),
      ),
      "REVIEW_WINDOW_CLOSED",
    );
    assert.equal(
      await h.admin.run(internal.dashboard.revealReviewsAfterDeadline, {
        reservationId: reservation._id,
      }),
      true,
    );
    const published = await host.client.run(api.dashboard.publishedReviews, {
      listingId,
      paginationOpts: firstPage,
    });
    assert.ok(
      published.page.some((review) => review.guestRatings?.overall === 2),
    );
  });

  test("shows trip details only to the guest and shares the address once confirmed", async () => {
    const guest = await h.as("tripdetail");
    const outsider = await h.as("tripoutsider");
    const host = await h.as("host");
    const held = await h.book(guest.client, listingId, stayDates(90, 2));

    assert.equal(
      await errorCode(
        outsider.client.run(api.dashboard.tripDetail, {
          reservationId: held._id,
        }),
      ),
      "FORBIDDEN",
    );
    assert.equal(
      await errorCode(
        host.client.run(api.dashboard.tripDetail, { reservationId: held._id }),
      ),
      "FORBIDDEN",
    );
    const pending = await guest.client.run(api.dashboard.tripDetail, {
      reservationId: held._id,
    });
    assert.equal(pending.listing?.address, null);

    const paid = await h.bookAndPay(guest.client, listingId, stayDates(95, 2));
    const confirmed = await guest.client.run(api.dashboard.tripDetail, {
      reservationId: paid._id,
    });
    assert.equal(confirmed.reservation.status, "confirmed");
    assert.ok(confirmed.listing?.address?.line1);
  });

  test("publishes availability as bare dates without reservation details", async () => {
    const guest = await h.as("availability");
    const dates = stayDates(100, 2);
    await h.book(guest.client, listingId, dates);
    const availability = await h.admin.run(api.listings.publicAvailability, {
      listingId,
      startDate: dates.checkIn,
      endDate: dates.checkOut,
    });
    assert.ok(availability);
    assert.equal(availability.unavailableDates.length, 2);
    assert.ok(
      availability.unavailableDates.every((date) => typeof date === "string"),
    );
    assert.equal(
      await errorCode(
        h.admin.run(api.listings.publicAvailability, {
          listingId,
          startDate: dates.checkOut,
          endDate: dates.checkIn,
        }),
      ),
      "INVALID_LISTING_INPUT",
    );
  });

  test("reports booked nights and simulated earnings by month", async () => {
    const host = await h.as("host");
    const guest = await h.as("earnings");
    const dates = stayDates(3, 2);
    const reservation = await h.bookAndPay(guest.client, listingId, dates);
    const earnings = await host.client.run(api.dashboard.hostEarnings, {});
    const months = earnings.months as {
      month: string;
      bookedNights: number;
      earnedCents: number;
    }[];
    const booked = reservation.quote.nightlyCharges.map(
      (night: { date: string }) => night.date.slice(0, 7),
    );
    for (const month of new Set(booked)) {
      const summary = months.find((entry) => entry.month === month);
      assert.ok(summary && summary.bookedNights > 0 && summary.earnedCents > 0);
    }
  });

  test("reconciles host earnings with completed bookings", async () => {
    const host = await h.as("host");
    const guest = await (await h.as("trips")).client;
    const reservation = await h.bookAndPay(guest, listingId, stayDates(80, 3));
    await h.completeStay(reservation._id);

    const state = await h.inspect(reservation._id);
    const dashboard = await host.client.run(api.dashboard.hostDashboard, {});
    const payouts = await host.client.run(api.dashboard.payoutHistory, {
      paginationOpts: { numItems: 100, cursor: null },
    });
    const payoutTotal = payouts.page.reduce(
      (total: number, payout: { amountCents: number }) =>
        total + payout.amountCents,
      0,
    );
    assert.equal(dashboard.simulatedEarnings.paidOutCents, payoutTotal);
    assert.equal(
      state?.payouts[0].amountCents,
      reservation.quote.hostProceedsCents,
    );
    const trips = await guest.run(api.dashboard.guestTrips, {
      paginationOpts: firstPage,
    });
    assert.ok(
      trips.page.some(
        (trip: { reservation: { _id: string } }) =>
          trip.reservation._id === reservation._id,
      ),
    );
  });
});
