import { formatStayDate } from "@/components/listing/price-breakdown";
import type { ReservationContext } from "@/lib/messaging/inbox-presentation";
import { cn } from "@/lib/utils";

export type InboxEntry = {
  conversationId: string;
  reservationId: string;
  latestMessageAt?: number;
  lastReadAt?: number;
  unread: boolean;
  participant: { id: string; name?: string; imageUrl?: string } | null;
  reservation: ReservationContext | null;
};

export function displayName(name: string | null | undefined) {
  return name?.trim() || "Checkin member";
}

export function Avatar({
  name,
  className,
}: {
  name: string | null | undefined;
  className?: string;
}) {
  const initials = displayName(name)
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
  return (
    <span
      aria-hidden
      className={cn(
        "grid size-10 shrink-0 place-items-center rounded-full bg-checkin-mist text-sm font-semibold text-checkin-ink",
        className,
      )}
    >
      {initials}
    </span>
  );
}

export function stayLabel(context: ReservationContext) {
  return `${formatStayDate(context.checkIn)} – ${formatStayDate(context.checkOut)}`;
}

const timeFormat = new Intl.DateTimeFormat("en-US", {
  hour: "numeric",
  minute: "2-digit",
});
const shortDateFormat = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
});

/** Time for today's activity, a short date for anything older. */
export function formatActivity(timestamp: number, now: number) {
  const date = new Date(timestamp);
  return new Date(now).toDateString() === date.toDateString()
    ? timeFormat.format(date)
    : shortDateFormat.format(date);
}

export function formatMessageTime(timestamp: number) {
  return timeFormat.format(new Date(timestamp));
}
