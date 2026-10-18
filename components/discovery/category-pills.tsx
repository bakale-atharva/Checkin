"use client";

import {
  Building2,
  LayoutGrid,
  Mountain,
  Sparkles,
  Tent,
  Trees,
  Waves,
  type LucideIcon,
} from "lucide-react";

import {
  discoveryCategories,
  type CategoryIcon,
} from "@/lib/discovery/catalog";
import { cn } from "@/lib/utils";

const icons: Record<CategoryIcon, LucideIcon> = {
  sparkles: Sparkles,
  trees: Trees,
  waves: Waves,
  mountain: Mountain,
  building: Building2,
  tent: Tent,
};

export function CategoryPills({
  selected,
  onSelect,
}: {
  selected: string | undefined;
  onSelect: (category: string | undefined) => void;
}) {
  const normalized = selected?.toLocaleLowerCase("en-US");
  const options = [
    { value: undefined, label: "All stays", Icon: LayoutGrid },
    ...discoveryCategories.map((category) => ({
      value: category.value as string | undefined,
      label: category.label,
      Icon: icons[category.icon],
    })),
  ];

  return (
    <nav
      aria-label="Categories"
      className="-mx-4 overflow-x-auto px-4 [scrollbar-width:none]"
    >
      <ul className="flex w-max gap-2 py-1">
        {options.map(({ value, label, Icon }) => {
          const active =
            value === undefined
              ? normalized === undefined
              : value.toLocaleLowerCase("en-US") === normalized;
          return (
            <li key={label}>
              <button
                type="button"
                aria-pressed={active}
                onClick={() => onSelect(value)}
                className={cn(
                  "inline-flex min-h-11 items-center gap-2 rounded-full border px-4 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-checkin-signal/35",
                  active
                    ? "border-checkin-ink bg-checkin-ink text-checkin-canvas"
                    : "border-checkin-line bg-checkin-paper text-checkin-ink hover:border-checkin-ink/40",
                )}
              >
                <Icon aria-hidden className="size-4" />
                {label}
              </button>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
