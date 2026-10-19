"use client";

import { usePaginatedQuery, useQuery } from "convex/react";
import { Wallet } from "lucide-react";
import dynamic from "next/dynamic";

import { formatStayDate } from "@/components/listing/price-breakdown";
import { Button } from "@/components/ui/button";
import { Surface } from "@/components/ui/surface";
import { useProfileReady } from "@/components/use-profile-ready";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { formatNightlyPrice } from "@/lib/discovery/catalog";
import type { MonthSummary } from "@/lib/earnings/earnings-summary";
import { cn } from "@/lib/utils";
import { SimulationBadge } from "./form-controls";

type Dashboard = {
  bookings: {
    pendingRequests: number;
    confirmed: number;
    completed: number;
    cancelled: number;
  };
  simulatedEarnings: {
    paidOutCents: number;
    upcomingCents: number;
    refundedGuestTotalCents: number;
    refundFailures: number;
  };
  truncated: boolean;
};

type Earnings = {
  months: MonthSummary[];
  currentMonth: string;
  publishedListings: number;
  truncated: boolean;
};

type Payout = {
  _id: Id<"simulatedPayouts">;
  amountCents: number;
  paidAt: number;
  listingTitle: string | null;
  checkIn: string | null;
  checkOut: string | null;
};

const monthShort = new Intl.DateTimeFormat("en-US", {
  month: "short",
  timeZone: "UTC",
});
const monthLong = new Intl.DateTimeFormat("en-US", {
  month: "long",
  year: "numeric",
  timeZone: "UTC",
});
const paidOn = new Intl.DateTimeFormat("en-US", { dateStyle: "medium" });

function monthDate(month: string) {
  return new Date(`${month}-01T00:00:00Z`);
}

function percent(rate: number) {
  return `${Math.round(rate * 100)}%`;
}

function ChartPlaceholder() {
  return (
    <div className="aspect-[2/1] animate-pulse rounded-[0.8rem] bg-checkin-mist/60 motion-reduce:animate-none" />
  );
}

// visx and motion are only needed here, so they load after the figures.
const EarningsBarChart = dynamic(() => import("./earnings-bar-chart"), {
  ssr: false,
  loading: ChartPlaceholder,
});

export function HostEarnings() {
  const profileReady = useProfileReady();
  const dashboard = useQuery(
    api.dashboard.hostDashboard,
    profileReady ? {} : "skip",
  ) as Dashboard | undefined;
  const earnings = useQuery(
    api.dashboard.hostEarnings,
    profileReady ? {} : "skip",
  ) as Earnings | undefined;
  const payouts = usePaginatedQuery(
    api.dashboard.payoutHistory,
    profileReady ? {} : "skip",
    { initialNumItems: 10 },
  );

  const chartData = (earnings?.months ?? []).map((month) => ({
    month: monthShort.format(monthDate(month.month)),
    label: monthLong.format(monthDate(month.month)),
    earned: month.earnedCents / 100,
    occupancy: Math.round(month.occupancyRate * 100),
    earnedCents: month.earnedCents,
    occupancyRate: month.occupancyRate,
  }));

  return (
    <main className="mx-auto w-full max-w-[90rem] flex-1 px-4 py-10 sm:px-6 lg:px-8">
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-3xl font-semibold tracking-[-0.05em]">Earnings</h1>
        <SimulationBadge>Simulated money</SimulationBadge>
      </div>
      <p className="mt-1 max-w-2xl text-checkin-muted">
        Demo revenue from your bookings: accommodation plus cleaning fees,
        before any real-world taxes. Nothing here is paid out for real.
      </p>

      <dl className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat
          label="Paid out"
          value={
            dashboard &&
            formatNightlyPrice(dashboard.simulatedEarnings.paidOutCents)
          }
          hint="After completed stays"
        />
        <Stat
          label="Upcoming"
          value={
            dashboard &&
            formatNightlyPrice(dashboard.simulatedEarnings.upcomingCents)
          }
          hint={
            dashboard
              ? `${dashboard.bookings.confirmed} confirmed bookings`
              : undefined
          }
        />
        <Stat
          label="Refunded to guests"
          value={
            dashboard &&
            formatNightlyPrice(
              dashboard.simulatedEarnings.refundedGuestTotalCents,
            )
          }
          hint={
            dashboard
              ? `${dashboard.bookings.cancelled} cancellations`
              : undefined
          }
        />
        <Stat
          label="Booking requests"
          value={dashboard && String(dashboard.bookings.pendingRequests)}
          hint="Waiting on your answer"
        />
      </dl>
      {dashboard && dashboard.simulatedEarnings.refundFailures > 0 ? (
        <p role="status" className="mt-4 text-sm text-checkin-signal">
          {dashboard.simulatedEarnings.refundFailures} simulated{" "}
          {dashboard.simulatedEarnings.refundFailures === 1
            ? "refund is"
            : "refunds are"}{" "}
          being retried by support.
        </p>
      ) : null}

      <div className="mt-10 grid gap-6 xl:grid-cols-2">
        <ChartCard
          title="Earnings by month"
          caption="Each night counts in the month it falls in; cleaning fees count in the arrival month. Five months back to six ahead."
          loading={earnings === undefined}
          chart={
            <EarningsBarChart
              data={chartData}
              dataKey="earned"
              color="var(--chart-1)"
              formatValue={(point) =>
                formatNightlyPrice(Number(point.earnedCents))
              }
            />
          }
          table={
            <table className="w-full text-sm">
              <caption className="sr-only">Simulated earnings by month</caption>
              <thead>
                <tr className="text-left text-checkin-muted">
                  <th scope="col" className="py-2 font-medium">
                    Month
                  </th>
                  <th scope="col" className="py-2 text-right font-medium">
                    Earned
                  </th>
                  <th scope="col" className="py-2 text-right font-medium">
                    Refunded
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-checkin-line">
                {(earnings?.months ?? []).map((month) => (
                  <tr
                    key={month.month}
                    className={cn(
                      month.month === earnings?.currentMonth && "font-semibold",
                    )}
                  >
                    <th scope="row" className="py-2 text-left font-[inherit]">
                      {monthLong.format(monthDate(month.month))}
                      {month.month === earnings?.currentMonth ? (
                        <span className="sr-only"> (this month)</span>
                      ) : null}
                    </th>
                    <td className="py-2 text-right tabular-nums">
                      {formatNightlyPrice(month.earnedCents)}
                    </td>
                    <td className="py-2 text-right tabular-nums text-checkin-muted">
                      {formatNightlyPrice(month.refundedCents)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          }
        />
        <ChartCard
          title="Occupancy by month"
          caption={
            earnings
              ? `Booked nights as a share of nights available across your ${earnings.publishedListings} published ${earnings.publishedListings === 1 ? "listing" : "listings"}.`
              : "Booked nights as a share of nights available."
          }
          loading={earnings === undefined}
          chart={
            <EarningsBarChart
              data={chartData}
              dataKey="occupancy"
              color="var(--chart-3)"
              formatValue={(point) => percent(Number(point.occupancyRate))}
            />
          }
          table={
            <table className="w-full text-sm">
              <caption className="sr-only">Occupancy by month</caption>
              <thead>
                <tr className="text-left text-checkin-muted">
                  <th scope="col" className="py-2 font-medium">
                    Month
                  </th>
                  <th scope="col" className="py-2 text-right font-medium">
                    Booked nights
                  </th>
                  <th scope="col" className="py-2 text-right font-medium">
                    Occupancy
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-checkin-line">
                {(earnings?.months ?? []).map((month) => (
                  <tr
                    key={month.month}
                    className={cn(
                      month.month === earnings?.currentMonth && "font-semibold",
                    )}
                  >
                    <th scope="row" className="py-2 text-left font-[inherit]">
                      {monthLong.format(monthDate(month.month))}
                    </th>
                    <td className="py-2 text-right tabular-nums">
                      {month.bookedNights} / {month.availableNights}
                    </td>
                    <td className="py-2 text-right tabular-nums">
                      {percent(month.occupancyRate)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          }
        />
      </div>
      {earnings?.truncated || dashboard?.truncated ? (
        <p className="mt-3 text-xs text-checkin-muted">
          Figures cover your 500 most recent bookings.
        </p>
      ) : null}

      <section aria-labelledby="payouts-heading" className="mt-12">
        <h2 id="payouts-heading" className="text-xl font-semibold">
          Payout history
        </h2>
        <p className="mt-1 text-sm text-checkin-muted">
          A simulated payout is recorded when a stay completes.
        </p>
        {payouts.status === "LoadingFirstPage" ? (
          <p role="status" className="mt-6 text-sm text-checkin-muted">
            Loading payouts…
          </p>
        ) : payouts.results.length === 0 ? (
          <div className="mt-6 flex items-center gap-3 rounded-[1rem] border border-dashed border-checkin-line px-5 py-6 text-sm text-checkin-muted">
            <Wallet aria-hidden className="size-5 shrink-0" />
            No payouts yet. They appear after your first guest checks out.
          </div>
        ) : (
          <div className="mt-6 overflow-x-auto rounded-[1.1rem] border border-checkin-line bg-checkin-paper">
            <table className="w-full min-w-[34rem] text-sm">
              <thead>
                <tr className="border-b border-checkin-line text-left text-checkin-muted">
                  <th scope="col" className="px-5 py-3 font-medium">
                    Paid
                  </th>
                  <th scope="col" className="px-5 py-3 font-medium">
                    Listing
                  </th>
                  <th scope="col" className="px-5 py-3 font-medium">
                    Stay
                  </th>
                  <th scope="col" className="px-5 py-3 text-right font-medium">
                    Amount
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-checkin-line">
                {(payouts.results as Payout[]).map((payout) => (
                  <tr key={payout._id}>
                    <td className="px-5 py-3 whitespace-nowrap">
                      {paidOn.format(payout.paidAt)}
                    </td>
                    <td className="max-w-56 truncate px-5 py-3">
                      {payout.listingTitle ?? "Removed listing"}
                    </td>
                    <td className="px-5 py-3 whitespace-nowrap text-checkin-muted">
                      {payout.checkIn && payout.checkOut
                        ? `${formatStayDate(payout.checkIn)} – ${formatStayDate(payout.checkOut)}`
                        : "–"}
                    </td>
                    <td className="px-5 py-3 text-right font-semibold tabular-nums">
                      {formatNightlyPrice(payout.amountCents)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {payouts.status === "CanLoadMore" ? (
          <Button
            type="button"
            variant="outline"
            className="mt-4"
            onClick={() => payouts.loadMore(10)}
          >
            Load more payouts
          </Button>
        ) : null}
      </section>
    </main>
  );
}

function Stat({
  label,
  value,
  hint,
}: {
  label: string;
  value: string | undefined;
  hint?: string;
}) {
  return (
    <Surface className="px-5 py-4">
      <dt className="text-sm text-checkin-muted">{label}</dt>
      <dd className="mt-1 text-2xl font-semibold tabular-nums tracking-[-0.03em]">
        {value ?? <span className="text-checkin-muted">–</span>}
      </dd>
      {hint ? <dd className="text-xs text-checkin-muted">{hint}</dd> : null}
    </Surface>
  );
}

/** A chart for sighted users with the same figures in a table for everyone. */
function ChartCard({
  title,
  caption,
  loading,
  chart,
  table,
}: {
  title: string;
  caption: string;
  loading: boolean;
  chart: React.ReactNode;
  table: React.ReactNode;
}) {
  return (
    <Surface className="min-w-0 p-5">
      <figure>
        <figcaption>
          <h2 className="font-semibold">{title}</h2>
          <p className="mt-1 text-sm text-checkin-muted">{caption}</p>
        </figcaption>
        <div aria-hidden className="mt-4">
          {loading ? <ChartPlaceholder /> : chart}
        </div>
        <details className="mt-4">
          <summary className="cursor-pointer text-sm font-semibold underline underline-offset-4">
            Show as table
          </summary>
          <div className="mt-2">{table}</div>
        </details>
      </figure>
    </Surface>
  );
}
