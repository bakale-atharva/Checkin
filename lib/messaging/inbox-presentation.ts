export type ReservationRole = "guest" | "host";

export type ReservationContext = {
  reservationId: string;
  role: ReservationRole;
  status: string;
  listingTitle: string | null;
  checkIn: string;
  checkOut: string;
};

export type NotificationKind =
  "reservation_action" | "review_eligible" | "message";

/** Where a guest or host goes to see a reservation from a message or notification. */
export function reservationHref(context: ReservationContext) {
  return context.role === "guest"
    ? `/trips/${context.reservationId}`
    : "/hosting/calendar";
}

export function notificationHref(notification: {
  kind: NotificationKind;
  conversationId?: string;
  context: ReservationContext | null;
}) {
  if (notification.kind === "message" && notification.conversationId)
    return `/inbox/${notification.conversationId}`;
  if (!notification.context) return null;
  if (notification.kind === "review_eligible")
    return `/reviews/${notification.context.reservationId}`;
  return reservationHref(notification.context);
}

export function notificationCopy(notification: {
  kind: NotificationKind;
  context: ReservationContext | null;
}) {
  const place = notification.context?.listingTitle ?? "your stay";
  switch (notification.kind) {
    case "message":
      return {
        title: "New message",
        body: `About ${place}.`,
      };
    case "review_eligible":
      return {
        title: "Time to leave a review",
        body: `You have 14 days to review ${place}. Reviews publish once you both submit or the window closes.`,
      };
    default:
      return {
        title: "Reservation updated",
        body: `${place} is now ${reservationStatusLabel(notification.context?.status)}.`,
      };
  }
}

export function reservationStatusLabel(status: string | undefined) {
  switch (status) {
    case "pending":
      return "pending";
    case "confirmed":
      return "confirmed";
    case "cancelled":
      return "cancelled";
    case "completed":
      return "completed";
    case "declined":
      return "declined";
    case "expired":
      return "expired";
    default:
      return "updated";
  }
}

/** Badge text for an unread count; the server stops counting at its scan cap. */
export function badgeCount(count: number, capped: boolean) {
  if (count <= 0) return null;
  if (count > 99) return "99+";
  return capped ? `${count}+` : String(count);
}

/**
 * Index of the first message the viewer hasn't read yet, ignoring their own
 * messages. Messages are in chronological order.
 */
export function firstUnreadIndex(
  messages: readonly { createdAt: number; senderProfileId: string }[],
  lastReadAt: number | null,
  viewerProfileId: string,
) {
  return messages.findIndex(
    (message) =>
      message.senderProfileId !== viewerProfileId &&
      message.createdAt > (lastReadAt ?? 0),
  );
}

const dayKeyFormat = (timeZone?: string) =>
  new Intl.DateTimeFormat("en-CA", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    timeZone,
  });

/** Groups chronological messages into consecutive calendar days. */
export function groupMessagesByDay<T extends { createdAt: number }>(
  messages: readonly T[],
  timeZone?: string,
) {
  const format = dayKeyFormat(timeZone);
  const groups: { day: string; messages: T[] }[] = [];
  for (const message of messages) {
    const day = format.format(new Date(message.createdAt));
    const last = groups.at(-1);
    if (last?.day === day) last.messages.push(message);
    else groups.push({ day, messages: [message] });
  }
  return groups;
}

/** "Today", "Yesterday", or a short date for a YYYY-MM-DD day key. */
export function dayLabel(day: string, now: number, timeZone?: string) {
  const format = dayKeyFormat(timeZone);
  if (day === format.format(new Date(now))) return "Today";
  if (day === format.format(new Date(now - 86_400_000))) return "Yesterday";
  return new Intl.DateTimeFormat("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${day}T12:00:00Z`));
}
