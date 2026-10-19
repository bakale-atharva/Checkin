import { MessagesSquare } from "lucide-react";

/** The right-hand pane before a conversation is chosen (wide screens only). */
export default function InboxPage() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-2 px-6 text-center text-checkin-muted">
      <MessagesSquare aria-hidden className="size-8" />
      <p className="font-semibold text-checkin-ink">Pick a conversation</p>
      <p className="max-w-xs text-sm">
        Messages stay between you and the other person on the reservation.
      </p>
    </div>
  );
}
