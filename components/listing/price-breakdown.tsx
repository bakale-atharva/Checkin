import { SimulationBadge } from "@/components/hosting/form-controls";
import { formatNightlyPrice } from "@/lib/discovery/catalog";
import { cn } from "@/lib/utils";

export type PriceLines = {
  nightlyCharges: { date: string; amountCents: number }[];
  accommodationCents: number;
  cleaningFeeCents: number;
  serviceFeeCents: number;
  taxCents: number;
  totalCents: number;
};

type PriceBreakdownProps = { quote: PriceLines; className?: string };

/** Itemized charges for a quoted or reserved stay. */
export function PriceBreakdown(props: PriceBreakdownProps) {
  return <PriceLinesList {...props} totalLabel="Total (USD)" />;
}

/** Itemized charges for dates the guest is still choosing. */
export function EstimatedPriceBreakdown(props: PriceBreakdownProps) {
  return <PriceLinesList {...props} totalLabel="Estimated total" />;
}

/** Nightly charges, fees, and total. Every amount is a simulated test-mode price. */
function PriceLinesList({
  quote,
  totalLabel,
  className,
}: PriceBreakdownProps & { totalLabel: string }) {
  const nights = quote.nightlyCharges.length;
  const rates = new Set(quote.nightlyCharges.map((night) => night.amountCents));
  const accommodationLabel =
    rates.size === 1
      ? `${formatNightlyPrice(quote.nightlyCharges[0].amountCents)} × ${nights} ${nights === 1 ? "night" : "nights"}`
      : `${nights} ${nights === 1 ? "night" : "nights"} (rates vary by date)`;

  return (
    <div className={cn("text-sm", className)}>
      <dl className="space-y-2">
        <Line label={accommodationLabel} cents={quote.accommodationCents} />
        {rates.size > 1 ? (
          <details className="text-checkin-muted">
            <summary className="cursor-pointer text-xs font-semibold underline underline-offset-4">
              Show nightly rates
            </summary>
            <ul className="mt-2 space-y-1 text-xs tabular-nums">
              {quote.nightlyCharges.map((night) => (
                <li key={night.date} className="flex justify-between">
                  <span>{formatStayDate(night.date)}</span>
                  <span>{formatNightlyPrice(night.amountCents)}</span>
                </li>
              ))}
            </ul>
          </details>
        ) : null}
        {quote.cleaningFeeCents > 0 ? (
          <Line label="Cleaning fee" cents={quote.cleaningFeeCents} />
        ) : null}
        <Line label="Checkin service fee (10%)" cents={quote.serviceFeeCents} />
        <Line label="Taxes (demo: none)" cents={quote.taxCents} />
      </dl>
      <div className="mt-3 flex items-center justify-between gap-3 border-t border-checkin-line pt-3 font-semibold">
        <span className="flex flex-wrap items-center gap-2">
          {totalLabel}
          <SimulationBadge>Simulated</SimulationBadge>
        </span>
        <span className="tabular-nums">
          {formatNightlyPrice(quote.totalCents)}
        </span>
      </div>
    </div>
  );
}

function Line({ label, cents }: { label: string; cents: number }) {
  return (
    <div className="flex justify-between gap-3">
      <dt className="text-checkin-muted">{label}</dt>
      <dd className="tabular-nums">{formatNightlyPrice(cents)}</dd>
    </div>
  );
}

const stayDateFormat = new Intl.DateTimeFormat("en-US", {
  weekday: "short",
  month: "short",
  day: "numeric",
  timeZone: "UTC",
});

/** Formats a YYYY-MM-DD property-local date without shifting it by timezone. */
export function formatStayDate(date: string) {
  return stayDateFormat.format(new Date(`${date}T00:00:00Z`));
}

/** Formats an ISO timestamp as wall-clock time in the property's timezone. */
export function formatLocalDateTime(iso: string, timezone: string) {
  return new Intl.DateTimeFormat("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZone: timezone,
    timeZoneName: "short",
  }).format(new Date(iso));
}
