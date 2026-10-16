import { verifyWebhook } from "@clerk/nextjs/webhooks";
import { fetchMutation } from "convex/nextjs";
import type { NextRequest } from "next/server";

import { api } from "@/convex/_generated/api";

function isHostPlan(slug: string | undefined): slug is "free_host" | "host_pro" {
  return slug === "free_host" || slug === "host_pro";
}

export async function POST(request: NextRequest) {
  let event;
  try {
    event = await verifyWebhook(request);
  } catch {
    return new Response("Invalid webhook signature", { status: 400 });
  }

  const eventId = request.headers.get("svix-id");
  const ingestSecret = process.env.CLERK_BILLING_INGEST_SECRET;
  if (!eventId || !ingestSecret) {
    return new Response("Webhook endpoint is not configured", { status: 503 });
  }

  if (
    event.type === "subscription.created" ||
    event.type === "subscription.updated" ||
    event.type === "subscription.active" ||
    event.type === "subscription.pastDue"
  ) {
    const clerkUserId = event.data.payer.user_id;
    const item = event.data.items.find((candidate) => isHostPlan(candidate.plan?.slug));
    const plan = item?.plan;
    if (!clerkUserId || !plan) return new Response(null, { status: 200 });
    await fetchMutation(api.billing.ingestSubscriptionWebhook, {
      ingestSecret,
      clerkEventId: eventId,
      clerkSubscriptionId: event.data.id,
      clerkUserId,
      planSlug: plan.slug,
      status: event.data.status,
      effectiveUntil: item.period_end,
      occurredAt: event.data.updated_at,
      isSubscriptionItem: false,
    });
    return new Response(null, { status: 200 });
  }

  if (
    event.type === "subscriptionItem.created" ||
    event.type === "subscriptionItem.updated" ||
    event.type === "subscriptionItem.active" ||
    event.type === "subscriptionItem.canceled" ||
    event.type === "subscriptionItem.upcoming" ||
    event.type === "subscriptionItem.ended" ||
    event.type === "subscriptionItem.abandoned" ||
    event.type === "subscriptionItem.incomplete" ||
    event.type === "subscriptionItem.pastDue" ||
    event.type === "subscriptionItem.freeTrialEnding"
  ) {
    const clerkUserId = event.data.payer?.user_id;
    if (!clerkUserId || !isHostPlan(event.data.plan?.slug)) {
      return new Response(null, { status: 200 });
    }
    await fetchMutation(api.billing.ingestSubscriptionWebhook, {
      ingestSecret,
      clerkEventId: eventId,
      clerkSubscriptionId: event.data.id,
      clerkUserId,
      planSlug: event.data.plan.slug,
      status: event.data.status,
      effectiveUntil: event.data.period_end,
      occurredAt: event.timestamp,
      isSubscriptionItem: true,
    });
  }
  return new Response(null, { status: 200 });
}
