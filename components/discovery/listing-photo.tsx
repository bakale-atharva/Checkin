"use client";

import { House } from "lucide-react";
import Image from "next/image";
import { useState } from "react";

import { cn } from "@/lib/utils";

/** A listing photo that falls back to a quiet placeholder when missing or broken. */
export function ListingPhoto({
  src,
  alt,
  sizes,
  preload,
  className,
}: {
  src: string | null | undefined;
  alt: string;
  sizes: string;
  preload?: boolean;
  className?: string;
}) {
  const [failed, setFailed] = useState(false);

  if (!src || failed) {
    return (
      <div
        role="img"
        aria-label={`${alt} (photo unavailable)`}
        className={cn(
          "grid size-full place-items-center bg-[linear-gradient(135deg,var(--checkin-mist),var(--checkin-canvas))] text-checkin-muted",
          className,
        )}
      >
        <House aria-hidden className="size-8 opacity-60" />
      </div>
    );
  }

  return (
    <Image
      fill
      src={src}
      alt={alt}
      sizes={sizes}
      preload={preload}
      onError={() => setFailed(true)}
      className={cn("object-cover", className)}
    />
  );
}
