import { ConvexError } from "convex/values";
import type {
  InputHTMLAttributes,
  ReactNode,
  SelectHTMLAttributes,
  TextareaHTMLAttributes,
} from "react";

import { cn } from "@/lib/utils";

const controlBase =
  "w-full rounded-[0.7rem] border border-checkin-line bg-checkin-paper px-3 text-sm text-checkin-ink placeholder:text-checkin-muted/80 transition-colors focus-visible:border-checkin-ink focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-checkin-signal/25 disabled:opacity-50";

export function Field({
  label,
  hint,
  htmlFor,
  children,
  className,
}: {
  label: string;
  hint?: ReactNode;
  htmlFor: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <label htmlFor={htmlFor} className="text-sm font-semibold">
        {label}
      </label>
      {children}
      {hint ? <p className="text-xs text-checkin-muted">{hint}</p> : null}
    </div>
  );
}

export function TextInput({
  className,
  ...props
}: InputHTMLAttributes<HTMLInputElement>) {
  return <input className={cn(controlBase, "h-11", className)} {...props} />;
}

export function TextArea({
  className,
  ...props
}: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      className={cn(controlBase, "min-h-32 py-2.5 leading-relaxed", className)}
      {...props}
    />
  );
}

export function Select({
  className,
  ...props
}: SelectHTMLAttributes<HTMLSelectElement>) {
  return <select className={cn(controlBase, "h-11", className)} {...props} />;
}

/** A labelled whole-number stepper for capacity counts. */
export function Stepper({
  id,
  label,
  value,
  min,
  max,
  step = 1,
  onChange,
}: {
  id: string;
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  onChange: (value: number) => void;
}) {
  const button =
    "grid size-9 pointer-coarse:size-11 place-items-center rounded-full border border-checkin-line text-lg leading-none transition-colors hover:bg-checkin-mist/60 focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-checkin-signal/35 disabled:opacity-35";
  return (
    <div className="flex items-center justify-between gap-4 py-3">
      <span id={`${id}-label`} className="font-medium">
        {label}
      </span>
      <div
        role="group"
        aria-labelledby={`${id}-label`}
        className="flex items-center gap-3"
      >
        <button
          type="button"
          className={button}
          aria-label={`Decrease ${label.toLowerCase()}`}
          disabled={value <= min}
          onClick={() => onChange(Math.max(min, value - step))}
        >
          −
        </button>
        <output aria-live="polite" className="w-8 text-center tabular-nums">
          {value}
        </output>
        <button
          type="button"
          className={button}
          aria-label={`Increase ${label.toLowerCase()}`}
          disabled={value >= max}
          onClick={() => onChange(Math.min(max, value + step))}
        >
          +
        </button>
      </div>
    </div>
  );
}

export function SimulationBadge({ children }: { children?: ReactNode }) {
  return (
    <span className="inline-flex items-center rounded-full border border-dashed border-checkin-signal/60 px-2.5 py-0.5 text-[0.7rem] font-semibold uppercase tracking-wide text-checkin-signal">
      {children ?? "Test mode"}
    </span>
  );
}

/** Reads the user-facing message from a Convex error, with a fallback. */
export function errorMessage(error: unknown, fallback: string) {
  if (error instanceof ConvexError) {
    const data = error.data as { message?: unknown } | string;
    if (typeof data === "string") return data;
    if (typeof data?.message === "string") return data.message;
  }
  return fallback;
}
