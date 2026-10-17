import type { HTMLAttributes } from "react";
import { cn } from "@/lib/utils";
export function PropertyFrame({ className, ...props }: HTMLAttributes<HTMLDivElement>) { return <article className={cn("@container/property overflow-hidden rounded-[1.1rem] bg-checkin-paper", className)} {...props} />; }
