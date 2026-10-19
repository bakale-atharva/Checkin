import type { Doc } from "@/convex/_generated/dataModel";
import { cn } from "@/lib/utils";

const statusStyles = {
  published: "bg-checkin-mist text-checkin-ink",
  draft: "bg-checkin-paper text-checkin-muted border border-checkin-line",
  archived: "bg-checkin-line/60 text-checkin-muted",
  suspended: "bg-checkin-signal/10 text-checkin-signal",
} as const;

export function ListingStatusBadge({
  listing,
}: {
  listing: Pick<Doc<"listings">, "status" | "bookingSuspended">;
}) {
  const key =
    listing.status === "published" && listing.bookingSuspended
      ? "suspended"
      : listing.status;
  return (
    <span
      className={cn(
        "rounded-full px-3 py-1 text-xs font-semibold capitalize",
        statusStyles[key],
      )}
    >
      {key === "suspended" ? "Suspended" : key}
    </span>
  );
}
