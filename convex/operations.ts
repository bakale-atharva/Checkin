import { v } from "convex/values";

import { REVIEW_WINDOW_MS } from "../lib/reviews/review-policy";
import { internal } from "./_generated/api";
import type { Doc, Id } from "./_generated/dataModel";
import { internalMutation, internalQuery } from "./_generated/server";
import type { MutationCtx } from "./_generated/server";

const RECONCILE_BATCH = 50;
const SCHEDULED_FUNCTION_SCAN = 200;
// Simulated payment delays are capped at 24 hours; anything pending longer is stalled.
const PAYMENT_OPERATION_STALL_MS = 25 * 60 * 60 * 1000;

type OperationalEventKind = Doc<"operationalEvents">["kind"];
type Severity = Doc<"operationalEvents">["severity"];

const operationalEventValidator = v.object({
  _id: v.id("operationalEvents"),
  _creationTime: v.number(),
  dedupeKey: v.string(),
  kind: v.string(),
  severity: v.string(),
  message: v.string(),
  reservationId: v.optional(v.id("reservations")),
  paymentOperationId: v.optional(v.id("paymentOperations")),
  scheduledFunctionId: v.optional(v.id("_scheduled_functions")),
  status: v.string(),
  resolutionNote: v.optional(v.string()),
  resolvedBy: v.optional(v.string()),
  createdAt: v.number(),
  resolvedAt: v.optional(v.number()),
});

/**
 * Emits one structured log line (visible in `npx convex logs` and log streams)
 * and records an open operational event unless the same dedupe key already exists.
 */
export async function recordOperationalEvent(
  ctx: MutationCtx,
  event: {
    dedupeKey: string;
    kind: OperationalEventKind;
    severity: Severity;
    message: string;
    reservationId?: Id<"reservations">;
    paymentOperationId?: Id<"paymentOperations">;
    scheduledFunctionId?: Id<"_scheduled_functions">;
  },
) {
  const existing = await ctx.db
    .query("operationalEvents")
    .withIndex("by_dedupe_key", (q) => q.eq("dedupeKey", event.dedupeKey))
    .first();
  if (existing) return false;
  const now = Date.now();
  const line = JSON.stringify({ source: "checkin.ops", ...event, at: new Date(now).toISOString() });
  if (event.severity === "error") console.error(line);
  else if (event.severity === "warning") console.warn(line);
  else console.log(line);
  await ctx.db.insert("operationalEvents", { ...event, status: "open", createdAt: now });
  return true;
}

async function repairMissedTransitions(ctx: MutationCtx, now: number) {
  let repaired = 0;
  const expiredHolds = await ctx.db.query("reservations")
    .withIndex("by_status_and_payment_hold_expires_at", (q) => q.eq("status", "pending").lt("paymentHoldExpiresAt", now))
    .take(RECONCILE_BATCH);
  for (const reservation of expiredHolds) {
    if (reservation.paymentHoldExpiresAt === undefined) continue;
    if (await ctx.runMutation(internal.reservations.expirePaymentHold, {
      reservationId: reservation._id, expiresAt: reservation.paymentHoldExpiresAt,
    })) repaired += 1;
  }

  const expiredRequests = await ctx.db.query("reservations")
    .withIndex("by_status_and_request_expires_at", (q) => q.eq("status", "pending").lt("requestExpiresAt", now))
    .take(RECONCILE_BATCH);
  for (const reservation of expiredRequests) {
    if (reservation.requestExpiresAt === undefined) continue;
    if (await ctx.runMutation(internal.reservations.expireRequest, {
      reservationId: reservation._id, expiresAt: reservation.requestExpiresAt,
    })) repaired += 1;
  }

  // checkOut is a property-local date; the UTC date of `now` + 1 is a safe superset.
  const tomorrow = new Date(now + 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const finishedStays = await ctx.db.query("reservations")
    .withIndex("by_status_and_check_out", (q) => q.eq("status", "confirmed").lte("checkOut", tomorrow))
    .take(RECONCILE_BATCH);
  for (const reservation of finishedStays) {
    if (Date.parse(reservation.checkOutAt) > now) continue;
    if (await ctx.runMutation(internal.reservations.markCompleted, { reservationId: reservation._id })) repaired += 1;
  }

  // A review submitted more than 14 days ago is necessarily past its reservation's deadline.
  const overdueReviews = await ctx.db.query("reviews")
    .withIndex("by_revealed_at_and_submitted_at", (q) => q.eq("revealedAt", undefined).lt("submittedAt", now - REVIEW_WINDOW_MS))
    .take(RECONCILE_BATCH);
  for (const reservationId of new Set(overdueReviews.map((review) => review.reservationId))) {
    if (await ctx.runMutation(internal.dashboard.revealReviewsAfterDeadline, { reservationId })) repaired += 1;
  }

  if (repaired > 0) {
    console.warn(JSON.stringify({ source: "checkin.ops", kind: "missed_transition_repaired", count: repaired }));
  }
  return repaired;
}

async function reconcilePaymentOperations(ctx: MutationCtx, now: number) {
  let flagged = 0;
  const stalled = await ctx.db.query("paymentOperations")
    .withIndex("by_status_and_updated_at", (q) => q.eq("status", "pending").lt("updatedAt", now - PAYMENT_OPERATION_STALL_MS))
    .take(RECONCILE_BATCH);
  for (const operation of stalled) {
    const reservation = await ctx.db.get(operation.reservationId);
    await ctx.db.patch(operation._id, { status: "failed", updatedAt: now });
    if (operation.kind === "refund") {
      if (reservation && reservation.paymentStatus === "paid") {
        await ctx.db.patch(reservation._id, { paymentStatus: "refund_failed", updatedAt: now });
      }
      await recordOperationalEvent(ctx, {
        dedupeKey: `refund_stalled:${operation._id}:${operation.attempts}`,
        kind: "refund_stalled",
        severity: "error",
        message: "Simulated refund never settled; marked failed for support retry.",
        reservationId: operation.reservationId,
        paymentOperationId: operation._id,
      });
    } else {
      await recordOperationalEvent(ctx, {
        dedupeKey: `payment_operation_abandoned:${operation._id}`,
        kind: "payment_operation_abandoned",
        severity: "warning",
        message: "Simulated charge never settled; the payment hold has already lapsed.",
        reservationId: operation.reservationId,
        paymentOperationId: operation._id,
      });
    }
    flagged += 1;
  }
  return flagged;
}

async function reconcileFailedScheduledFunctions(ctx: MutationCtx) {
  let flagged = 0;
  const recent = await ctx.db.system.query("_scheduled_functions").order("desc").take(SCHEDULED_FUNCTION_SCAN);
  for (const job of recent) {
    if (job.state.kind !== "failed") continue;
    if (await recordOperationalEvent(ctx, {
      dedupeKey: `scheduled_function_failed:${job._id}`,
      kind: "scheduled_function_failed",
      severity: "error",
      message: `${job.name} failed: ${job.state.error}`.slice(0, 1_000),
      scheduledFunctionId: job._id,
    })) flagged += 1;
  }
  return flagged;
}

export const reconcileBackgroundOperations = internalMutation({
  args: {},
  returns: v.object({
    repairedTransitions: v.number(),
    flaggedPaymentOperations: v.number(),
    flaggedScheduledFunctions: v.number(),
  }),
  handler: async (ctx) => {
    const now = Date.now();
    const result = {
      repairedTransitions: await repairMissedTransitions(ctx, now),
      flaggedPaymentOperations: await reconcilePaymentOperations(ctx, now),
      flaggedScheduledFunctions: await reconcileFailedScheduledFunctions(ctx),
    };
    // Abandoned listing-photo uploads are also a background job without a scheduler of their own.
    await ctx.runMutation(internal.listings.cleanupExpiredPhotoUploads, {});
    return result;
  },
});

export const listOpenEvents = internalQuery({
  args: { limit: v.optional(v.number()) },
  returns: v.array(operationalEventValidator),
  handler: async (ctx, args) => {
    return await ctx.db.query("operationalEvents")
      .withIndex("by_status_and_created_at", (q) => q.eq("status", "open"))
      .order("desc")
      .take(Math.min(Math.max(args.limit ?? 50, 1), 200));
  },
});

/** Support override: close an operational event after acting on it. */
export const resolveEvent = internalMutation({
  args: { eventId: v.id("operationalEvents"), resolvedBy: v.string(), resolutionNote: v.string() },
  returns: v.boolean(),
  handler: async (ctx, args) => {
    const event = await ctx.db.get(args.eventId);
    if (!event || event.status !== "open") return false;
    if (!args.resolvedBy.trim() || !args.resolutionNote.trim()) {
      throw new Error("Support resolutions require an operator and a note.");
    }
    const now = Date.now();
    await ctx.db.patch(event._id, {
      status: "resolved",
      resolvedBy: args.resolvedBy.trim(),
      resolutionNote: args.resolutionNote.trim(),
      resolvedAt: now,
    });
    console.log(JSON.stringify({ source: "checkin.ops", kind: "event_resolved", eventId: event._id, resolvedBy: args.resolvedBy }));
    return true;
  },
});
