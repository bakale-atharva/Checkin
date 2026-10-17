import type { HTMLAttributes } from "react";
import { cn } from "@/lib/utils";

export function Surface({
  className,
  ...props
}: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "rounded-[1.1rem] border border-checkin-line bg-checkin-paper shadow-[0_12px_35px_rgb(23_35_31/0.05)]",
        className,
      )}
      {...props}
    />
  );
}
