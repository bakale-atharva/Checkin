"use client";

import { useMutation } from "convex/react";
import { MessageCircle } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { errorMessage } from "@/components/hosting/form-controls";
import { Button, type ButtonProps } from "@/components/ui/button";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";

/** Opens (creating if needed) the private conversation for a reservation. */
export function MessageButton({
  reservationId,
  label,
  variant = "outline",
  size,
}: {
  reservationId: Id<"reservations">;
  label: string;
  variant?: ButtonProps["variant"];
  size?: ButtonProps["size"];
}) {
  const router = useRouter();
  const open = useMutation(api.dashboard.getOrCreateReservationConversation);
  const [opening, setOpening] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function start() {
    setOpening(true);
    setError(null);
    try {
      router.push(`/inbox/${await open({ reservationId })}`);
    } catch (caught) {
      setError(errorMessage(caught, "Couldn't open the conversation."));
      setOpening(false);
    }
  }

  return (
    <span className="inline-flex flex-col gap-1">
      <Button
        type="button"
        variant={variant}
        size={size}
        disabled={opening}
        onClick={() => void start()}
      >
        <MessageCircle aria-hidden className="size-4" />
        {opening ? "Opening…" : label}
      </Button>
      {error ? (
        <span role="alert" className="text-xs font-medium text-checkin-signal">
          {error}
        </span>
      ) : null}
    </span>
  );
}
