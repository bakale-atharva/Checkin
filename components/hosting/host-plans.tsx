"use client";

import { PricingTable } from "@clerk/nextjs";
import { useConvexAuth, useMutation, useQuery } from "convex/react";
import { Check } from "lucide-react";
import { useState } from "react";

import { Surface } from "@/components/ui/surface";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import {
  FREE_HOST_PUBLICATION_ALLOWANCE,
  HOST_PRO_PUBLICATION_ALLOWANCE,
} from "@/lib/billing/host-plan-policy";
import { errorMessage, SimulationBadge } from "./form-controls";
import { useHostAllowance } from "./use-host-allowance";

const plans = [
  {
    name: "Free Host",
    price: "$0",
    summary: `Publish ${FREE_HOST_PUBLICATION_ALLOWANCE} property, create drafts, manage availability and bookings, message guests, and view simulated earnings.`,
    features: [
      "Unlimited drafts with photos and property details",
      "Availability, booking requests, and reservations",
      "Private guest messaging",
      "Simulated earnings, fees, refunds, and payouts",
    ],
  },
  {
    name: "Host Pro",
    price: "$19/month",
    summary: `Publish up to ${HOST_PRO_PUBLICATION_ALLOWANCE} properties and manage them from one account.`,
    features: [
      "Everything in Free Host",
      `Up to ${HOST_PRO_PUBLICATION_ALLOWANCE} published properties`,
      "Multi-property calendar and bookings",
    ],
  },
] as const;

const dateFormat = new Intl.DateTimeFormat("en-US", { dateStyle: "medium" });

export function HostPlans() {
  const allowance = useHostAllowance();
  const subscription = allowance.subscription;
  const cancelling =
    subscription?.planSlug === "host_pro" &&
    subscription.status === "canceled" &&
    subscription.effectiveUntil !== null;

  return (
    <main className="mx-auto w-full max-w-[90rem] flex-1 px-4 py-10 sm:px-6 lg:px-8">
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-3xl font-semibold tracking-[-0.05em]">
          Plan &amp; billing
        </h1>
        <SimulationBadge>Clerk test mode</SimulationBadge>
      </div>
      <p className="mt-1 max-w-2xl text-checkin-muted">
        Subscriptions run in Clerk&apos;s test mode — use a test card, no real
        money moves. Changing plans never affects reservations you already have.
      </p>

      {allowance.loaded ? (
        <Surface className="mt-6 px-5 py-4">
          <p className="text-sm text-checkin-muted">Current plan</p>
          <p className="font-semibold">
            {allowance.isPro ? "Host Pro" : "Free Host"} ·{" "}
            {allowance.publishedCount} of {allowance.allowance} published
          </p>
          {cancelling && subscription?.effectiveUntil ? (
            <p className="mt-1 text-sm text-checkin-muted">
              Host Pro ends on{" "}
              {dateFormat.format(new Date(subscription.effectiveUntil))}. Until
              then you keep the ten-listing allowance.
            </p>
          ) : null}
        </Surface>
      ) : null}

      <section aria-labelledby="plans-heading" className="mt-10">
        <h2 id="plans-heading" className="text-xl font-semibold">
          What each plan includes
        </h2>
        <ul className="mt-4 grid gap-4 md:grid-cols-2">
          {plans.map((plan) => (
            <li key={plan.name}>
              <Surface className="h-full p-6">
                <p className="text-lg font-semibold">{plan.name}</p>
                <p className="text-2xl font-semibold tracking-[-0.04em]">
                  {plan.price}
                </p>
                <p className="mt-2 text-sm text-checkin-muted">
                  {plan.summary}
                </p>
                <ul className="mt-4 flex flex-col gap-2 text-sm">
                  {plan.features.map((feature) => (
                    <li key={feature} className="flex gap-2">
                      <Check
                        aria-hidden
                        className="mt-0.5 size-4 shrink-0 text-checkin-signal"
                      />
                      {feature}
                    </li>
                  ))}
                </ul>
              </Surface>
            </li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="checkout-heading" className="mt-10">
        <h2 id="checkout-heading" className="text-xl font-semibold">
          Change plan
        </h2>
        <p className="mt-1 text-sm text-checkin-muted">
          Checkout opens in Clerk. Your new allowance applies as soon as Clerk
          confirms the change.
        </p>
        <div className="mt-6">
          <PricingTable
            newSubscriptionRedirectUrl="/hosting/plans"
            fallback={
              <p className="text-sm text-checkin-muted">Loading plans…</p>
            }
          />
        </div>
      </section>

      <DowngradeSelection />
    </main>
  );
}

/**
 * On the free plan only one published listing takes new bookings. Hosts with
 * more than one choose which; the rest are suspended, never deleted.
 */
function DowngradeSelection() {
  const { isAuthenticated } = useConvexAuth();
  const allowance = useHostAllowance();
  const profile = useQuery(
    api.users.currentProfile,
    isAuthenticated ? {} : "skip",
  );
  const selectFreeListing = useMutation(
    api.billing.selectFreeListingForDowngrade,
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!allowance.loaded || allowance.publishedCount < 2) return null;

  const published = [...allowance.published].sort(
    (a, b) => (a.publishedAt ?? a.createdAt) - (b.publishedAt ?? b.createdAt),
  );
  const bookable = allowance.isPro
    ? (published.find(
        (listing) => listing._id === profile?.selectedFreeListingId,
      )?._id ?? published[0]?._id)
    : published.find((listing) => !listing.bookingSuspended)?._id;

  async function choose(listingId: Id<"listings">) {
    setSaving(true);
    setError(null);
    try {
      await selectFreeListing({ listingId });
    } catch (caught) {
      setError(errorMessage(caught, "Couldn't save your choice."));
    } finally {
      setSaving(false);
    }
  }

  return (
    <section aria-labelledby="downgrade-heading" className="mt-12">
      <h2 id="downgrade-heading" className="text-xl font-semibold">
        {allowance.isPro
          ? "If you move to Free Host"
          : "Listing that stays bookable"}
      </h2>
      <p className="mt-1 max-w-2xl text-sm text-checkin-muted">
        {allowance.isPro
          ? "Free Host keeps one published listing open to new bookings. Choose it now; the others are suspended from new bookings when Host Pro ends, and their existing reservations continue."
          : "Your plan allows one bookable listing. The others stay published but are suspended from new bookings, and their existing reservations continue. You can switch at any time."}
      </p>
      {error ? (
        <p
          role="alert"
          className="mt-3 text-sm font-medium text-checkin-signal"
        >
          {error}
        </p>
      ) : null}
      <fieldset disabled={saving} className="mt-4 grid gap-2 md:max-w-xl">
        <legend className="sr-only">Listing that stays bookable</legend>
        {published.map((listing, index) => (
          <label
            key={listing._id}
            className="flex min-h-12 cursor-pointer items-center gap-3 rounded-[0.8rem] border border-checkin-line bg-checkin-paper px-4 has-checked:border-checkin-ink has-checked:bg-checkin-mist/40"
          >
            <input
              type="radio"
              name="free-listing"
              className="size-4 accent-checkin-ink"
              checked={bookable === listing._id}
              onChange={() => void choose(listing._id)}
            />
            <span className="min-w-0 flex-1">
              <span className="block truncate font-medium">
                {listing.title}
              </span>
              <span className="text-xs text-checkin-muted">
                {listing.publicLocation.city}
                {index === 0 ? " · oldest published (default)" : ""}
                {!allowance.isPro && listing.bookingSuspended
                  ? " · suspended"
                  : ""}
              </span>
            </span>
          </label>
        ))}
      </fieldset>
    </section>
  );
}
