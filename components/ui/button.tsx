import { cva, type VariantProps } from "class-variance-authority";
import type { ButtonHTMLAttributes } from "react";
import { cn } from "@/lib/utils";
const buttonVariants = cva("inline-flex min-h-11 items-center justify-center gap-2 rounded-[0.8rem] px-4 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-checkin-signal/35 disabled:pointer-events-none disabled:opacity-45", { variants: { variant: { primary: "bg-checkin-ink text-checkin-canvas hover:bg-checkin-ink/90", signal: "bg-checkin-signal text-white hover:bg-checkin-signal/90", quiet: "bg-checkin-mist text-checkin-ink hover:bg-checkin-mist/70", outline: "border border-checkin-line bg-transparent text-checkin-ink hover:bg-checkin-mist/45" }, size: { default: "h-11", sm: "h-9 px-3 text-xs", lg: "h-13 px-5 text-base" } }, defaultVariants: { variant: "primary", size: "default" } });
export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement>, VariantProps<typeof buttonVariants> {}
export function Button({ className, variant, size, ...props }: ButtonProps) { return <button className={cn(buttonVariants({ variant, size }), className)} {...props} />; }
