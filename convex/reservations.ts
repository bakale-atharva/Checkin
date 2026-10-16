import { ConvexError, v } from "convex/values";

import {
  ReservationPolicyError,
  createReservationQuote,
  isCancellationRefundEligible,
  reservationForBookingMode,
  stayDates,
  transitionReservation,
  type ReservationStatus,
} from "../lib/reservations/reservation-policy";
import { assertProfileOwner, requireProfile } from "./auth";
import type { Doc, Id } from "./_generated/dataModel";
import { internal } from "./_generated/api";
import { internalMutation, mutation, query } from "./_generated/server";
import type { MutationCtx, QueryCtx } from "./_generated/server";

const QUOTE_TTL_MS = 15 * 60 * 1000;
const INSTANT_PAYMENT_HOLD_MS = 15 * 60 * 1000;
const REQUEST_EXPIRY_MS = 24 * 60 * 60 * 1000;

const reservationStatusValidator = v.union(
  v.literal("pending"), v.literal("confirmed"), v.literal("cancelled"),
  v.literal("completed"), v.literal("declined"), v.literal("expired"),
);
const paymentStatusValidator = v.union(
  v.literal("not_required"), v.literal("hold"), v.literal("paid"),
  v.literal("declined"), v.literal("refunded"), v.literal("refund_failed"),
);
const paymentOutcomeValidator = v.union(
  v.literal("success"), v.literal("decline"), v.literal("delay"), v.literal("refund_failure"),
);
const quoteValidator = v.object({
  nightlyCharges: v.array(v.object({ date: v.string(), amountCents: v.number() })),
  accommodationCents: v.number(), cleaningFeeCents: v.number(), serviceFeeCents: v.number(),
  taxCents: v.number(), totalCents: v.number(), hostProceedsCents: v.number(),
  checkInAt: v.string(), checkOutAt: v.string(),
  cancellationDeadline: v.string(),
});
const reservationValidator = v.object({
  _id: v.id("reservations"), _creationTime: v.number(),
  listingId: v.id("listings"), guestProfileId: v.id("users"), hostProfileId: v.id("users"),
  quoteId: v.id("reservationQuotes"), idempotencyKey: v.string(), checkIn: v.string(), checkOut: v.string(),
  guests: v.number(), bookingMode: v.union(v.literal("instant"), v.literal("request")),
  status: reservationStatusValidator, paymentStatus: paymentStatusValidator,
  paymentHoldExpiresAt: v.optional(v.number()), requestExpiresAt: v.optional(v.number()),
  checkInAt: v.string(), checkOutAt: v.string(),
  cancellationDeadline: v.string(),
  quote: v.object({
    nightlyCharges: v.array(v.object({ date: v.string(), amountCents: v.number() })),
    accommodationCents: v.number(), cleaningFeeCents: v.number(), serviceFeeCents: v.number(),
    taxCents: v.number(), totalCents: v.number(), hostProceedsCents: v.number(),
  }),
  createdAt: v.number(), updatedAt: v.number(),
});

function reservationError(code: string, message: string) {
  return new ConvexError({ code, message });
}

function asReservationPolicyError(error: unknown) {
  if (error instanceof ReservationPolicyError) {
    throw reservationError("INVALID_RESERVATION", error.message);
  }
  throw error;
}

function snapshotQuote(quote: ReturnType<typeof createReservationQuote>) {
  return {
    nightlyCharges: quote.nightlyCharges,
    accommodationCents: quote.accommodationCents,
    cleaningFeeCents: quote.cleaningFeeCents,
    serviceFeeCents: quote.serviceFeeCents,
    taxCents: quote.taxCents,
    totalCents: quote.totalCents,
    hostProceedsCents: quote.hostProceedsCents,
  };
}

async function assertReservationAvailability(
  ctx: QueryCtx | MutationCtx,
  listingId: Id<"listings">,
  checkIn: string,
  checkOut: string,
) {
  let dates: string[];
  try {
    dates = stayDates(checkIn, checkOut);
  } catch (error) {
    asReservationPolicyError(error);
  }
  for (const date of dates!) {
    const [blocked, occupied] = await Promise.all([
      ctx.db.query("blockedDates").withIndex("by_listing_id_and_date", (q) =>
        q.eq("listingId", listingId).eq("date", date),
      ).unique(),
      ctx.db.query("reservationNights").withIndex("by_listing_id_and_date", (q) =>
        q.eq("listingId", listingId).eq("date", date),
      ).unique(),
    ]);
    if (blocked || occupied) {
      throw reservationError("UNAVAILABLE", "Those dates are no longer available.");
    }
  }
  return dates!;
}

async function reserveInventory(
  ctx: MutationCtx,
  reservationId: Id<"reservations">,
  listingId: Id<"listings">,
  checkIn: string,
  checkOut: string,
) {
  const dates = await assertReservationAvailability(ctx, listingId, checkIn, checkOut);
  const now = Date.now();
  await Promise.all(dates.map((date) => ctx.db.insert("reservationNights", {
    reservationId, listingId, date, createdAt: now,
  })));
}

async function releaseInventory(ctx: MutationCtx, reservationId: Id<"reservations">) {
  const nights = await ctx.db.query("reservationNights")
    .withIndex("by_reservation_id", (q) => q.eq("reservationId", reservationId)).take(29);
  await Promise.all(nights.map((night) => ctx.db.delete(night._id)));
}

async function schedulePaymentResolution(
  ctx: MutationCtx,
  operation: Doc<"paymentOperations">,
) {
  const scenario = await ctx.db.query("paymentSimulationScenarios")
    .withIndex("by_reservation_id_and_kind", (q) => q.eq("reservationId", operation.reservationId).eq("kind", operation.kind))
    .unique();
  await ctx.scheduler.runAfter(scenario?.delayMs ?? 0, internal.reservations.resolvePaymentOperation, {
    paymentOperationId: operation._id,
    attempt: operation.attempts,
    outcome: scenario?.outcome ?? "success",
  });
}

function checkInTimestamp(reservation: Doc<"reservations">) {
  return Date.parse(reservation.checkInAt);
}

async function expireReservation(
  ctx: MutationCtx,
  reservation: Doc<"reservations">,
  expectedHoldExpiresAt: number | undefined,
  expectedRequestExpiresAt: number | undefined,
) {
  if (reservation.status !== "pending") return false;
  if (
    (expectedHoldExpiresAt !== undefined && reservation.paymentHoldExpiresAt !== expectedHoldExpiresAt) ||
    (expectedRequestExpiresAt !== undefined && reservation.requestExpiresAt !== expectedRequestExpiresAt)
  ) return false;
  const deadline = expectedHoldExpiresAt ?? expectedRequestExpiresAt;
  if (deadline === undefined || deadline > Date.now()) return false;
  await ctx.db.patch(reservation._id, {
    status: "expired", paymentStatus: reservation.paymentStatus === "hold" ? "declined" : reservation.paymentStatus,
    updatedAt: Date.now(),
  });
  await releaseInventory(ctx, reservation._id);
  return true;
}

export const quote = mutation({
  args: { listingId: v.id("listings"), checkIn: v.string(), checkOut: v.string(), guests: v.number() },
  returns: v.object({ quoteId: v.id("reservationQuotes"), expiresAt: v.number(), quote: quoteValidator }),
  handler: async (ctx, args) => {
    const guest = await requireProfile(ctx);
    const listing = await ctx.db.get(args.listingId);
    if (!listing || listing.status !== "published" || listing.bookingSuspended) {
      throw reservationError("LISTING_UNAVAILABLE", "This listing is not available for booking.");
    }
    if (!Number.isInteger(args.guests) || args.guests < 1 || args.guests > listing.maxGuests) {
      throw reservationError("INVALID_GUESTS", "The guest count is invalid for this listing.");
    }
    await assertReservationAvailability(ctx, listing._id, args.checkIn, args.checkOut);
    const overrides: Record<string, number> = {};
    let dates: string[];
    try { dates = stayDates(args.checkIn, args.checkOut); } catch (error) { asReservationPolicyError(error); }
    for (const date of dates!) {
      const override = await ctx.db.query("nightlyPriceOverrides")
        .withIndex("by_listing_id_and_date", (q) => q.eq("listingId", listing._id).eq("date", date)).unique();
      if (override) overrides[date] = override.nightlyPriceCents;
    }
    let computedQuote: ReturnType<typeof createReservationQuote>;
    try {
      computedQuote = createReservationQuote({
        checkIn: args.checkIn, checkOut: args.checkOut, timezone: listing.timezone,
        checkInTime: listing.checkInTime, checkOutTime: listing.checkOutTime, nightlyPriceCents: listing.nightlyPriceCents,
        cleaningFeeCents: listing.cleaningFeeCents, nightlyPriceOverrides: overrides,
      });
    } catch (error) { asReservationPolicyError(error); }
    const now = Date.now();
    const expiresAt = now + QUOTE_TTL_MS;
    const quoteId = await ctx.db.insert("reservationQuotes", {
      listingId: listing._id, guestProfileId: guest._id, checkIn: args.checkIn, checkOut: args.checkOut,
      guests: args.guests, expiresAt, quote: computedQuote!, createdAt: now,
    });
    await ctx.scheduler.runAfter(QUOTE_TTL_MS, internal.reservations.expireQuote, { quoteId, expiresAt });
    return { quoteId, expiresAt, quote: computedQuote! };
  },
});

export const createFromQuote = mutation({
  args: { quoteId: v.id("reservationQuotes"), idempotencyKey: v.string() },
  returns: reservationValidator,
  handler: async (ctx, args) => {
    const guest = await requireProfile(ctx);
    if (!args.idempotencyKey.trim()) throw reservationError("INVALID_IDEMPOTENCY_KEY", "An idempotency key is required.");
    const existing = await ctx.db.query("reservations")
      .withIndex("by_guest_profile_id_and_idempotency_key", (q) => q.eq("guestProfileId", guest._id).eq("idempotencyKey", args.idempotencyKey)).unique();
    if (existing) return existing;
    const quote = await ctx.db.get(args.quoteId);
    if (!quote || quote.guestProfileId !== guest._id || quote.expiresAt <= Date.now()) {
      throw reservationError("QUOTE_EXPIRED", "This quote has expired. Request a new quote.");
    }
    const listing = await ctx.db.get(quote.listingId);
    if (!listing || listing.status !== "published" || listing.bookingSuspended) {
      throw reservationError("LISTING_UNAVAILABLE", "This listing is not available for booking.");
    }
    const mode = reservationForBookingMode(listing.bookingMode);
    const now = Date.now();
    const checkInAt = Date.parse(quote.quote.checkInAt);
    const paymentHoldExpiresAt = mode.inventoryReserved
      ? Math.min(now + INSTANT_PAYMENT_HOLD_MS, checkInAt)
      : undefined;
    const requestExpiresAt = mode.inventoryReserved ? undefined : Math.min(now + REQUEST_EXPIRY_MS, checkInAt);
    if ((paymentHoldExpiresAt ?? requestExpiresAt ?? 0) <= now) {
      throw reservationError("CHECK_IN_PASSED", "This stay can no longer be booked.");
    }
    const reservationId = await ctx.db.insert("reservations", {
      listingId: listing._id, guestProfileId: guest._id, hostProfileId: listing.ownerProfileId,
      quoteId: quote._id, idempotencyKey: args.idempotencyKey, checkIn: quote.checkIn, checkOut: quote.checkOut,
      guests: quote.guests, bookingMode: listing.bookingMode, status: mode.reservationStatus,
      paymentStatus: mode.paymentStatus, paymentHoldExpiresAt, requestExpiresAt,
      checkInAt: quote.quote.checkInAt, checkOutAt: quote.quote.checkOutAt,
      cancellationDeadline: quote.quote.cancellationDeadline, quote: snapshotQuote(quote.quote),
      createdAt: now, updatedAt: now,
    });
    if (mode.inventoryReserved) {
      await reserveInventory(ctx, reservationId, listing._id, quote.checkIn, quote.checkOut);
      await ctx.scheduler.runAfter(paymentHoldExpiresAt! - now, internal.reservations.expirePaymentHold, {
        reservationId, expiresAt: paymentHoldExpiresAt!,
      });
    } else {
      await ctx.scheduler.runAfter(requestExpiresAt! - now, internal.reservations.expireRequest, {
        reservationId, expiresAt: requestExpiresAt!,
      });
    }
    const reservation = await ctx.db.get(reservationId);
    if (!reservation) throw new Error("Reservation creation failed unexpectedly.");
    return reservation;
  },
});

export const respondToRequest = mutation({
  args: { reservationId: v.id("reservations"), accept: v.boolean() }, returns: reservationValidator,
  handler: async (ctx, args) => {
    const host = await requireProfile(ctx);
    const reservation = await ctx.db.get(args.reservationId);
    if (!reservation) throw reservationError("NOT_FOUND", "Reservation not found.");
    assertProfileOwner(reservation.hostProfileId, host._id);
    if (reservation.bookingMode !== "request" || reservation.status !== "pending" || reservation.paymentStatus !== "not_required" || (reservation.requestExpiresAt ?? 0) <= Date.now()) {
      throw reservationError("INVALID_STATE", "This request cannot be updated.");
    }
    if (!args.accept) {
      await ctx.db.patch(reservation._id, { status: transitionReservation("pending", "declined"), updatedAt: Date.now() });
    } else {
      const now = Date.now();
      const expiresAt = Math.min(now + REQUEST_EXPIRY_MS, checkInTimestamp(reservation));
      if (expiresAt <= now) throw reservationError("CHECK_IN_PASSED", "This stay can no longer be accepted.");
      await reserveInventory(ctx, reservation._id, reservation.listingId, reservation.checkIn, reservation.checkOut);
      await ctx.db.patch(reservation._id, { paymentStatus: "hold", paymentHoldExpiresAt: expiresAt, requestExpiresAt: undefined, updatedAt: now });
      await ctx.scheduler.runAfter(expiresAt - now, internal.reservations.expirePaymentHold, { reservationId: reservation._id, expiresAt });
    }
    const updated = await ctx.db.get(reservation._id);
    if (!updated) throw new Error("Reservation update failed unexpectedly.");
    return updated;
  },
});

export const capturePayment = mutation({
  args: { reservationId: v.id("reservations"), idempotencyKey: v.string() }, returns: reservationValidator,
  handler: async (ctx, args) => {
    const guest = await requireProfile(ctx);
    const reservation = await ctx.db.get(args.reservationId);
    if (!reservation) throw reservationError("NOT_FOUND", "Reservation not found.");
    assertProfileOwner(reservation.guestProfileId, guest._id);
    const existing = await ctx.db.query("paymentOperations")
      .withIndex("by_reservation_id_and_idempotency_key", (q) => q.eq("reservationId", reservation._id).eq("idempotencyKey", `charge:${args.idempotencyKey}`)).unique();
    if (existing) return reservation;
    const activeCharge = (await ctx.db.query("paymentOperations")
      .withIndex("by_reservation_id", (q) => q.eq("reservationId", reservation._id))
      .take(10))
      .find((operation) => operation.kind === "charge" && operation.status === "pending");
    if (activeCharge) return reservation;
    if (reservation.status !== "pending" || reservation.paymentStatus !== "hold" || (reservation.paymentHoldExpiresAt ?? 0) <= Date.now()) {
      throw reservationError("PAYMENT_HOLD_EXPIRED", "The payment hold has expired.");
    }
    const now = Date.now();
    const paymentOperationId = await ctx.db.insert("paymentOperations", { reservationId: reservation._id, kind: "charge", idempotencyKey: `charge:${args.idempotencyKey}`, amountCents: reservation.quote.totalCents, status: "pending", attempts: 1, createdAt: now, updatedAt: now });
    const paymentOperation = await ctx.db.get(paymentOperationId);
    if (paymentOperation) await schedulePaymentResolution(ctx, paymentOperation);
    const updated = await ctx.db.get(reservation._id);
    if (!updated) throw new Error("Payment capture failed unexpectedly.");
    return updated;
  },
});

export const cancel = mutation({
  args: { reservationId: v.id("reservations"), reason: v.string() },
  returns: v.union(v.object({ kind: v.literal("cancelled"), reservation: reservationValidator }), v.object({ kind: v.literal("support_required") })),
  handler: async (ctx, args) => {
    const actor = await requireProfile(ctx);
    const reservation = await ctx.db.get(args.reservationId);
    if (!reservation) throw reservationError("NOT_FOUND", "Reservation not found.");
    const isGuest = reservation.guestProfileId === actor._id;
    const isHost = reservation.hostProfileId === actor._id;
    if (!isGuest && !isHost) throw reservationError("FORBIDDEN", "You cannot cancel this reservation.");
    if (reservation.status !== "pending" && reservation.status !== "confirmed") throw reservationError("INVALID_STATE", "This reservation cannot be cancelled.");
    const checkInAt = reservation.checkInAt;
    if (isHost && Date.parse(checkInAt) <= Date.now()) {
      throw reservationError("CHECK_IN_PASSED", "Hosts can only cancel before check-in.");
    }
    if (isGuest && !isCancellationRefundEligible(checkInAt, new Date().toISOString())) {
      await ctx.db.insert("lateCancellationRequests", { reservationId: reservation._id, guestProfileId: actor._id, reason: args.reason, status: "open", createdAt: Date.now() });
      return { kind: "support_required" as const };
    }
    const now = Date.now();
    await ctx.db.patch(reservation._id, { status: transitionReservation(reservation.status as ReservationStatus, "cancelled"), updatedAt: now });
    await releaseInventory(ctx, reservation._id);
    if (reservation.paymentStatus === "paid") {
      const key = `refund:${reservation._id}`;
      const existingRefund = await ctx.db.query("paymentOperations").withIndex("by_reservation_id_and_idempotency_key", (q) => q.eq("reservationId", reservation._id).eq("idempotencyKey", key)).unique();
      if (!existingRefund) {
        const paymentOperationId = await ctx.db.insert("paymentOperations", { reservationId: reservation._id, kind: "refund", idempotencyKey: key, amountCents: reservation.quote.totalCents, status: "pending", attempts: 1, createdAt: now, updatedAt: now });
        const paymentOperation = await ctx.db.get(paymentOperationId);
        if (paymentOperation) await schedulePaymentResolution(ctx, paymentOperation);
      }
    }
    const updated = await ctx.db.get(reservation._id);
    if (!updated) throw new Error("Cancellation failed unexpectedly.");
    return { kind: "cancelled" as const, reservation: updated };
  },
});

export const expireQuote = internalMutation({
  args: { quoteId: v.id("reservationQuotes"), expiresAt: v.number() }, returns: v.null(),
  handler: async (ctx, args) => { const quote = await ctx.db.get(args.quoteId); if (quote?.expiresAt === args.expiresAt && quote.expiresAt <= Date.now()) await ctx.db.delete(quote._id); return null; },
});

export const resolveLateCancellation = internalMutation({
  args: {
    supportRequestId: v.id("lateCancellationRequests"),
    approveRefund: v.boolean(),
    supportProfileId: v.id("users"),
    resolutionNote: v.string(),
  },
  returns: v.boolean(),
  handler: async (ctx, args) => {
    const supportRequest = await ctx.db.get(args.supportRequestId);
    if (!supportRequest || supportRequest.status !== "open") return false;
    if (!args.resolutionNote.trim()) {
      throw reservationError("INVALID_RESOLUTION", "A support resolution note is required.");
    }
    const now = Date.now();
    await ctx.db.patch(supportRequest._id, {
      status: "resolved",
      resolution: args.approveRefund ? "refund_approved" : "declined",
      resolutionNote: args.resolutionNote,
      resolvedByProfileId: args.supportProfileId,
      resolvedAt: now,
    });
    if (!args.approveRefund) return true;
    const reservation = await ctx.db.get(supportRequest.reservationId);
    if (!reservation || (reservation.status !== "pending" && reservation.status !== "confirmed" && reservation.status !== "completed")) return true;
    if (reservation.status !== "completed") {
      await ctx.db.patch(reservation._id, {
        status: transitionReservation(reservation.status as ReservationStatus, "cancelled"),
        updatedAt: now,
      });
      await releaseInventory(ctx, reservation._id);
    }
    if (reservation.paymentStatus === "paid") {
      const idempotencyKey = `refund:${reservation._id}`;
      const existing = await ctx.db.query("paymentOperations")
        .withIndex("by_reservation_id_and_idempotency_key", (q) => q.eq("reservationId", reservation._id).eq("idempotencyKey", idempotencyKey)).unique();
      if (!existing) {
        const paymentOperationId = await ctx.db.insert("paymentOperations", {
          reservationId: reservation._id, kind: "refund", idempotencyKey,
          amountCents: reservation.quote.totalCents, status: "pending", attempts: 1,
          createdAt: now, updatedAt: now,
        });
        const paymentOperation = await ctx.db.get(paymentOperationId);
        if (paymentOperation) await schedulePaymentResolution(ctx, paymentOperation);
      }
    }
    return true;
  },
});

export const resolvePaymentOperation = internalMutation({
  args: { paymentOperationId: v.id("paymentOperations"), attempt: v.number(), outcome: paymentOutcomeValidator }, returns: v.boolean(),
  handler: async (ctx, args) => {
    const operation = await ctx.db.get(args.paymentOperationId);
    if (!operation || operation.status !== "pending" || operation.attempts !== args.attempt || args.outcome === "delay") return false;
    const reservation = await ctx.db.get(operation.reservationId);
    if (!reservation) return false;
    const now = Date.now();
    if (operation.kind === "charge") {
      if (args.outcome === "success" && reservation.status === "pending" && reservation.paymentStatus === "hold" && (reservation.paymentHoldExpiresAt ?? 0) > now) {
        await ctx.db.patch(operation._id, { status: "succeeded", updatedAt: now });
        await ctx.db.patch(reservation._id, { status: transitionReservation("pending", "confirmed"), paymentStatus: "paid", updatedAt: now });
        const completionDelay = Math.max(0, Date.parse(reservation.checkOutAt) - now);
        await ctx.scheduler.runAfter(completionDelay, internal.reservations.markCompleted, { reservationId: reservation._id });
        return true;
      }
      if (args.outcome === "decline" && reservation.status === "pending") {
        await ctx.db.patch(operation._id, { status: "declined", updatedAt: now });
        await ctx.db.patch(reservation._id, { status: "expired", paymentStatus: "declined", updatedAt: now });
        await releaseInventory(ctx, reservation._id);
        return true;
      }
      return false;
    }
    if (args.outcome === "success") {
      await ctx.db.patch(operation._id, { status: "succeeded", updatedAt: now });
      await ctx.db.patch(reservation._id, { paymentStatus: "refunded", updatedAt: now });
      return true;
    }
    if (args.outcome === "refund_failure") {
      await ctx.db.patch(operation._id, { status: "failed", updatedAt: now });
      await ctx.db.patch(reservation._id, { paymentStatus: "refund_failed", updatedAt: now });
      return true;
    }
    return false;
  },
});

export const retryRefund = internalMutation({
  args: { paymentOperationId: v.id("paymentOperations"), outcome: paymentOutcomeValidator }, returns: v.boolean(),
  handler: async (ctx, args) => {
    const operation = await ctx.db.get(args.paymentOperationId);
    if (!operation || operation.kind !== "refund" || operation.status !== "failed") return false;
    const reservation = await ctx.db.get(operation.reservationId);
    if (!reservation || (reservation.status !== "cancelled" && reservation.status !== "completed")) return false;
    const now = Date.now();
    await ctx.db.patch(operation._id, { status: "pending", attempts: operation.attempts + 1, updatedAt: now });
    await ctx.db.patch(reservation._id, { paymentStatus: "paid", updatedAt: now });
    const pendingOperation = await ctx.db.get(operation._id);
    if (pendingOperation) {
      await ctx.scheduler.runAfter(0, internal.reservations.resolvePaymentOperation, { paymentOperationId: operation._id, attempt: pendingOperation.attempts, outcome: args.outcome });
    }
    return true;
  },
});

export const setPaymentSimulationScenario = internalMutation({
  args: { reservationId: v.id("reservations"), kind: v.union(v.literal("charge"), v.literal("refund")), outcome: paymentOutcomeValidator, delayMs: v.number() },
  returns: v.null(),
  handler: async (ctx, args) => {
    if (!Number.isInteger(args.delayMs) || args.delayMs < 0 || args.delayMs > REQUEST_EXPIRY_MS) {
      throw reservationError("INVALID_SIMULATION", "Simulation delay must be between zero and twenty-four hours.");
    }
    const existing = await ctx.db.query("paymentSimulationScenarios")
      .withIndex("by_reservation_id_and_kind", (q) => q.eq("reservationId", args.reservationId).eq("kind", args.kind)).unique();
    const fields = { reservationId: args.reservationId, kind: args.kind, outcome: args.outcome, delayMs: args.delayMs, updatedAt: Date.now() };
    if (existing) await ctx.db.patch(existing._id, fields);
    else await ctx.db.insert("paymentSimulationScenarios", fields);
    return null;
  },
});

export const expireRequest = internalMutation({
  args: { reservationId: v.id("reservations"), expiresAt: v.number() }, returns: v.boolean(),
  handler: async (ctx, args) => { const reservation = await ctx.db.get(args.reservationId); return reservation ? await expireReservation(ctx, reservation, undefined, args.expiresAt) : false; },
});

export const expirePaymentHold = internalMutation({
  args: { reservationId: v.id("reservations"), expiresAt: v.number() }, returns: v.boolean(),
  handler: async (ctx, args) => { const reservation = await ctx.db.get(args.reservationId); return reservation ? await expireReservation(ctx, reservation, args.expiresAt, undefined) : false; },
});

export const markCompleted = internalMutation({
  args: { reservationId: v.id("reservations") }, returns: v.boolean(),
  handler: async (ctx, args) => {
    const reservation = await ctx.db.get(args.reservationId);
    if (!reservation || reservation.status !== "confirmed" || Date.parse(reservation.checkOutAt) > Date.now()) return false;
    await ctx.db.patch(reservation._id, { status: "completed", updatedAt: Date.now() });
    return true;
  },
});

export const myReservations = query({
  args: {}, returns: v.array(reservationValidator),
  handler: async (ctx) => {
    const guest = await requireProfile(ctx);
    return await ctx.db.query("reservations").withIndex("by_guest_profile_id_and_created_at", (q) => q.eq("guestProfileId", guest._id)).order("desc").take(100);
  },
});
