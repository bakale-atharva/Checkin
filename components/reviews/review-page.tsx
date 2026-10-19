"use client";

import { useQuery } from "convex/react";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";

import { formatStayDate } from "@/components/listing/price-breakdown";
import { useProfileReady } from "@/components/use-profile-ready";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { ReviewPanel } from "./review-panel";

export function ReviewPage() {
  const { reservationId } = useParams<{ reservationId: string }>();
  const id = reservationId as Id<"reservations">;
  const profileReady = useProfileReady();
  // Shares the subscription ReviewPanel opens, so this costs no extra query.
  const review = useQuery(
    api.dashboard.reservationReviewStatus,
    profileReady ? { reservationId: id } : "skip",
  ) as
    | {
        role: "guest" | "host";
        listingTitle: string | null;
        counterpartFirstName: string | null;
        checkIn: string;
        checkOut: string;
      }
    | undefined;

  const back =
    review?.role === "host"
      ? { href: "/hosting", label: "Hosting" }
      : { href: `/trips/${id}`, label: "Trip" };

  return (
    <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-8 sm:px-6 lg:px-8">
      <Link
        href={back.href}
        className="mb-6 inline-flex min-h-11 items-center gap-2 text-sm font-semibold"
      >
        <ArrowLeft aria-hidden className="size-4" /> {back.label}
      </Link>
      <h1 className="text-3xl font-semibold tracking-[-0.05em]">
        {review?.role === "host"
          ? `Review ${review.counterpartFirstName ?? "your guest"}`
          : "Review your stay"}
      </h1>
      {review ? (
        <p className="mt-1 text-checkin-muted">
          {review.listingTitle ?? "Listing"} · {formatStayDate(review.checkIn)}{" "}
          – {formatStayDate(review.checkOut)}
        </p>
      ) : null}
      <div className="mt-8">
        <ReviewPanel reservationId={id} />
      </div>
    </main>
  );
}
