"use client";

import { SlidersHorizontal, X } from "lucide-react";
import { useId, useRef, useState, type FormEvent } from "react";

import { Button } from "@/components/ui/button";
import {
  bookingModeLabels,
  discoveryAmenities,
  propertyTypeLabels,
} from "@/lib/discovery/catalog";
import {
  countRefinements,
  type DiscoveryFilters,
} from "@/lib/discovery/discovery-params";
import type { BookingMode, PropertyType } from "@/lib/search/search-contract";
import { cn } from "@/lib/utils";

type Draft = Pick<
  DiscoveryFilters,
  "type" | "minPrice" | "maxPrice" | "amenities" | "mode"
>;

function draftFrom(filters: DiscoveryFilters): Draft {
  return {
    type: filters.type,
    minPrice: filters.minPrice,
    maxPrice: filters.maxPrice,
    amenities: filters.amenities,
    mode: filters.mode,
  };
}

function priceValue(value: string) {
  if (value.trim() === "") return undefined;
  const parsed = Math.floor(Number(value));
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : undefined;
}

export function FiltersDialog({
  filters,
  onApply,
}: {
  filters: DiscoveryFilters;
  onApply: (patch: Draft) => void;
}) {
  const id = useId();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [draft, setDraft] = useState<Draft>(() => draftFrom(filters));
  const refinements = countRefinements({ ...filters, sort: undefined });

  function open() {
    setDraft(draftFrom(filters));
    dialogRef.current?.showModal();
  }

  function apply(event: FormEvent) {
    event.preventDefault();
    let { minPrice, maxPrice } = draft;
    if (minPrice !== undefined && maxPrice !== undefined && minPrice > maxPrice)
      [minPrice, maxPrice] = [maxPrice, minPrice];
    onApply({ ...draft, minPrice, maxPrice });
    dialogRef.current?.close();
  }

  const empty: Draft = { amenities: [] };

  return (
    <>
      <button
        type="button"
        onClick={open}
        className="inline-flex min-h-11 items-center gap-2 rounded-full border border-checkin-line bg-checkin-paper px-4 text-sm font-semibold transition-colors hover:border-checkin-ink/40 focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-checkin-signal/35"
      >
        <SlidersHorizontal aria-hidden className="size-4" />
        Filters
        {refinements > 0 ? (
          <span className="grid min-w-5 place-items-center rounded-full bg-checkin-ink px-1.5 text-xs text-checkin-canvas">
            <span className="sr-only">, </span>
            {refinements}
            <span className="sr-only"> applied</span>
          </span>
        ) : null}
      </button>

      <dialog
        ref={dialogRef}
        aria-labelledby={`${id}-title`}
        className="m-auto w-[min(36rem,calc(100vw-2rem))] max-h-[min(44rem,calc(100dvh-2rem))] rounded-[1.25rem] border border-checkin-line bg-checkin-paper p-0 text-checkin-ink shadow-[0_30px_80px_rgb(23_35_31/0.25)] backdrop:bg-checkin-ink/40 backdrop:backdrop-blur-sm"
      >
        <form onSubmit={apply} className="flex max-h-[inherit] flex-col">
          <header className="flex items-center justify-between border-b border-checkin-line px-5 py-4">
            <h2
              id={`${id}-title`}
              className="text-lg font-semibold tracking-[-0.03em]"
            >
              Filters
            </h2>
            <button
              type="button"
              aria-label="Close filters"
              onClick={() => dialogRef.current?.close()}
              className="grid size-10 place-items-center rounded-full hover:bg-checkin-mist/50 focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-checkin-signal/35"
            >
              <X aria-hidden className="size-4" />
            </button>
          </header>

          <div className="flex-1 space-y-7 overflow-y-auto px-5 py-6">
            <fieldset>
              <legend className="mb-3 font-semibold">Type of place</legend>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                {(
                  [
                    undefined,
                    "entire_home",
                    "private_room",
                    "shared_room",
                  ] as const
                ).map((type) => (
                  <ChoiceChip
                    key={type ?? "any"}
                    name={`${id}-type`}
                    checked={draft.type === type}
                    onChange={() =>
                      setDraft((value) => ({
                        ...value,
                        type: type as PropertyType | undefined,
                      }))
                    }
                  >
                    {type ? propertyTypeLabels[type] : "Any type"}
                  </ChoiceChip>
                ))}
              </div>
            </fieldset>

            <fieldset>
              <legend className="mb-1 font-semibold">Nightly price</legend>
              <p className="mb-3 text-sm text-checkin-muted">
                Before fees, in USD.
              </p>
              <div className="grid grid-cols-2 gap-3">
                <PriceInput
                  id={`${id}-min`}
                  label="Minimum"
                  value={draft.minPrice}
                  onChange={(minPrice) =>
                    setDraft((value) => ({ ...value, minPrice }))
                  }
                />
                <PriceInput
                  id={`${id}-max`}
                  label="Maximum"
                  value={draft.maxPrice}
                  onChange={(maxPrice) =>
                    setDraft((value) => ({ ...value, maxPrice }))
                  }
                />
              </div>
            </fieldset>

            <fieldset>
              <legend className="mb-3 font-semibold">Booking</legend>
              <div className="grid gap-2 sm:grid-cols-3">
                {([undefined, "instant", "request"] as const).map((mode) => (
                  <ChoiceChip
                    key={mode ?? "any"}
                    name={`${id}-mode`}
                    checked={draft.mode === mode}
                    onChange={() =>
                      setDraft((value) => ({
                        ...value,
                        mode: mode as BookingMode | undefined,
                      }))
                    }
                  >
                    {mode ? bookingModeLabels[mode] : "Either"}
                  </ChoiceChip>
                ))}
              </div>
            </fieldset>

            <fieldset>
              <legend className="mb-3 font-semibold">Amenities</legend>
              <div className="grid grid-cols-2 gap-2">
                {discoveryAmenities.map((amenity) => {
                  const checked = draft.amenities.includes(amenity);
                  return (
                    <label
                      key={amenity}
                      className={cn(
                        "flex min-h-11 cursor-pointer items-center gap-3 rounded-[0.8rem] border px-3 text-sm font-medium transition-colors has-[:focus-visible]:ring-3 has-[:focus-visible]:ring-checkin-signal/35",
                        checked
                          ? "border-checkin-ink bg-checkin-mist/50"
                          : "border-checkin-line hover:border-checkin-ink/40",
                      )}
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() =>
                          setDraft((value) => ({
                            ...value,
                            amenities: checked
                              ? value.amenities.filter(
                                  (item) => item !== amenity,
                                )
                              : [...value.amenities, amenity].sort(
                                  (left, right) => left.localeCompare(right),
                                ),
                          }))
                        }
                        className="size-4 accent-checkin-ink"
                      />
                      {amenity}
                    </label>
                  );
                })}
              </div>
            </fieldset>
          </div>

          <footer className="flex items-center justify-between gap-3 border-t border-checkin-line px-5 py-4">
            <button
              type="button"
              onClick={() => setDraft(empty)}
              className="min-h-11 rounded-[0.7rem] px-2 text-sm font-semibold underline underline-offset-4 hover:text-checkin-signal focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-checkin-signal/35"
            >
              Clear all
            </button>
            <Button type="submit">Show stays</Button>
          </footer>
        </form>
      </dialog>
    </>
  );
}

function ChoiceChip({
  name,
  checked,
  onChange,
  children,
}: {
  name: string;
  checked: boolean;
  onChange: () => void;
  children: React.ReactNode;
}) {
  return (
    <label
      className={cn(
        "flex min-h-11 cursor-pointer items-center justify-center rounded-[0.8rem] border px-3 text-center text-sm font-semibold transition-colors has-[:focus-visible]:ring-3 has-[:focus-visible]:ring-checkin-signal/35",
        checked
          ? "border-checkin-ink bg-checkin-ink text-checkin-canvas"
          : "border-checkin-line hover:border-checkin-ink/40",
      )}
    >
      <input
        type="radio"
        name={name}
        checked={checked}
        onChange={onChange}
        className="sr-only"
      />
      {children}
    </label>
  );
}

function PriceInput({
  id,
  label,
  value,
  onChange,
}: {
  id: string;
  label: string;
  value: number | undefined;
  onChange: (value: number | undefined) => void;
}) {
  return (
    <label
      htmlFor={id}
      className="flex flex-col rounded-[0.8rem] border border-checkin-line px-3 py-2 focus-within:border-checkin-ink"
    >
      <span className="text-xs font-semibold text-checkin-muted">{label}</span>
      <span className="flex items-center gap-1 text-sm font-semibold">
        <span aria-hidden>$</span>
        <input
          id={id}
          type="number"
          inputMode="numeric"
          min={0}
          step={1}
          placeholder="Any"
          value={value ?? ""}
          onChange={(event) => onChange(priceValue(event.target.value))}
          className="w-full bg-transparent outline-none placeholder:font-medium placeholder:text-checkin-muted/80"
        />
      </span>
    </label>
  );
}
