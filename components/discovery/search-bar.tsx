"use client";

import {
  CalendarDays,
  MapPin,
  Minus,
  Plus,
  Search,
  UsersRound,
} from "lucide-react";
import { useEffect, useId, useState, type FormEvent } from "react";

import { Button } from "@/components/ui/button";
import { Surface } from "@/components/ui/surface";
import type { DiscoveryFilters } from "@/lib/discovery/discovery-params";
import {
  geocodePlaces,
  mapboxToken,
  type DestinationSuggestion,
} from "@/lib/discovery/geocoding";
import { seededDestinations } from "@/lib/search/seeded-destinations";
import { cn } from "@/lib/utils";

const MAX_GUESTS = 16;
const GEOCODE_DEBOUNCE_MS = 300;

function addDays(isoDate: string, days: number) {
  const date = new Date(`${isoDate}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function todayIso() {
  const now = new Date();
  return new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()))
    .toISOString()
    .slice(0, 10);
}

const seededSuggestions: DestinationSuggestion[] = seededDestinations.map(
  (destination) => ({
    city: destination.city,
    label: destination.city,
    latitude: destination.latitude,
    longitude: destination.longitude,
    source: "seeded",
  }),
);

export function SearchBar({
  filters,
  onSearch,
}: {
  filters: DiscoveryFilters;
  onSearch: (patch: Partial<DiscoveryFilters>) => void;
}) {
  const id = useId();
  const [where, setWhere] = useState(filters.where ?? "");
  const [near, setNear] = useState(filters.near);
  const [checkIn, setCheckIn] = useState(filters.checkIn ?? "");
  const [checkOut, setCheckOut] = useState(filters.checkOut ?? "");
  const [guests, setGuests] = useState(filters.guests ?? 0);
  const [open, setOpen] = useState(false);
  const [highlighted, setHighlighted] = useState(-1);
  const [remote, setRemote] = useState<{
    query: string;
    suggestions: DestinationSuggestion[];
  }>({ query: "", suggestions: [] });
  const [dateError, setDateError] = useState<string>();

  const query = where.trim();
  const seededMatches = seededSuggestions.filter((suggestion) =>
    suggestion.city
      .toLocaleLowerCase("en-US")
      .includes(query.toLocaleLowerCase("en-US")),
  );
  const remoteMatches =
    remote.query === query
      ? remote.suggestions.filter(
          (suggestion) =>
            !seededMatches.some(
              (seeded) =>
                seeded.city.toLocaleLowerCase("en-US") ===
                suggestion.city.toLocaleLowerCase("en-US"),
            ),
        )
      : [];
  const suggestions = [...seededMatches, ...remoteMatches];

  useEffect(() => {
    if (!mapboxToken || query.length < 2) return;
    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      geocodePlaces(query, mapboxToken!, controller.signal)
        .then((suggestions) => setRemote({ query, suggestions }))
        // Geocoding is optional; seeded destinations remain available.
        .catch(() => undefined);
    }, GEOCODE_DEBOUNCE_MS);
    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [query]);

  function choose(suggestion: DestinationSuggestion) {
    setWhere(suggestion.city);
    setNear(
      suggestion.source === "mapbox"
        ? { latitude: suggestion.latitude, longitude: suggestion.longitude }
        : undefined,
    );
    setOpen(false);
    setHighlighted(-1);
  }

  function submit(event: FormEvent) {
    event.preventDefault();
    if (Boolean(checkIn) !== Boolean(checkOut)) {
      setDateError("Choose both a check-in and a check-out date.");
      return;
    }
    setDateError(undefined);
    const trimmed = where.trim();
    const keepsNear = trimmed !== "" && trimmed === filters.where;
    onSearch({
      where: trimmed || undefined,
      near: near ?? (keepsNear ? filters.near : undefined),
      checkIn: checkIn || undefined,
      checkOut: checkOut || undefined,
      guests: guests > 0 ? guests : undefined,
    });
    setOpen(false);
  }

  const today = todayIso();
  const listboxId = `${id}-destinations`;

  return (
    <Surface className="@container/search p-1.5">
      <form
        role="search"
        aria-label="Search stays"
        onSubmit={submit}
        className="grid gap-1 @2xl/search:grid-cols-[1.4fr_1fr_1fr_0.9fr_auto]"
      >
        <div className="relative">
          <label
            htmlFor={`${id}-where`}
            className="flex min-h-14 cursor-text items-center gap-3 rounded-[0.8rem] px-3 transition-colors focus-within:bg-checkin-mist/40 hover:bg-checkin-mist/30 has-[:focus-visible]:ring-3 has-[:focus-visible]:ring-checkin-signal/35"
          >
            <MapPin
              aria-hidden
              className="size-4 shrink-0 text-checkin-signal"
            />
            <span className="flex min-w-0 flex-1 flex-col">
              <span className="text-[0.68rem] font-bold uppercase tracking-[0.14em] text-checkin-muted">
                Where
              </span>
              <input
                id={`${id}-where`}
                role="combobox"
                aria-expanded={open && suggestions.length > 0}
                aria-controls={listboxId}
                aria-autocomplete="list"
                aria-activedescendant={
                  highlighted >= 0 ? `${listboxId}-${highlighted}` : undefined
                }
                autoComplete="off"
                value={where}
                placeholder="Search destinations…"
                onChange={(event) => {
                  setWhere(event.target.value);
                  setNear(undefined);
                  setOpen(true);
                  setHighlighted(-1);
                }}
                onFocus={() => setOpen(true)}
                onBlur={() => window.setTimeout(() => setOpen(false), 120)}
                onKeyDown={(event) => {
                  if (!open || suggestions.length === 0) return;
                  if (event.key === "ArrowDown") {
                    event.preventDefault();
                    setHighlighted((value) => (value + 1) % suggestions.length);
                  } else if (event.key === "ArrowUp") {
                    event.preventDefault();
                    setHighlighted((value) =>
                      value <= 0 ? suggestions.length - 1 : value - 1,
                    );
                  } else if (event.key === "Enter" && highlighted >= 0) {
                    event.preventDefault();
                    choose(suggestions[highlighted]);
                  } else if (event.key === "Escape") {
                    setOpen(false);
                  }
                }}
                className="w-full truncate bg-transparent text-sm font-semibold text-checkin-ink outline-none placeholder:font-medium placeholder:text-checkin-muted/80"
              />
            </span>
          </label>
          {open && suggestions.length > 0 ? (
            <ul
              id={listboxId}
              role="listbox"
              aria-label="Destinations"
              className="absolute inset-x-0 top-full z-40 mt-2 max-h-80 overflow-auto rounded-[1rem] border border-checkin-line bg-checkin-paper p-1.5 shadow-[0_18px_45px_rgb(23_35_31/0.14)]"
            >
              {suggestions.map((suggestion, index) => (
                <li
                  key={`${suggestion.source}-${suggestion.label}`}
                  id={`${listboxId}-${index}`}
                  role="option"
                  aria-selected={highlighted === index}
                  onMouseDown={(event) => {
                    event.preventDefault();
                    choose(suggestion);
                  }}
                  className={cn(
                    "flex cursor-pointer items-center gap-3 rounded-[0.7rem] px-3 py-2.5 text-sm",
                    highlighted === index
                      ? "bg-checkin-mist/70"
                      : "hover:bg-checkin-mist/40",
                  )}
                >
                  <span className="grid size-8 place-items-center rounded-[0.6rem] bg-checkin-mist/70 text-checkin-ink">
                    <MapPin aria-hidden className="size-4" />
                  </span>
                  <span className="min-w-0">
                    <span className="block truncate font-semibold">
                      {suggestion.label}
                    </span>
                    <span className="block text-xs text-checkin-muted">
                      {suggestion.source === "seeded"
                        ? "Popular destination"
                        : "Place"}
                    </span>
                  </span>
                </li>
              ))}
            </ul>
          ) : null}
        </div>

        <DateField
          id={`${id}-check-in`}
          label="Check in"
          value={checkIn}
          min={today}
          onChange={(value) => {
            setCheckIn(value);
            if (
              value &&
              (!checkOut || checkOut <= value || checkOut > addDays(value, 28))
            )
              setCheckOut(addDays(value, 1));
          }}
        />
        <DateField
          id={`${id}-check-out`}
          label="Check out"
          value={checkOut}
          min={checkIn ? addDays(checkIn, 1) : addDays(today, 1)}
          max={checkIn ? addDays(checkIn, 28) : undefined}
          onChange={setCheckOut}
        />

        <div
          role="group"
          aria-labelledby={`${id}-guests-label`}
          className="flex min-h-14 items-center gap-3 rounded-[0.8rem] px-3"
        >
          <UsersRound
            aria-hidden
            className="size-4 shrink-0 text-checkin-signal"
          />
          <span className="flex flex-1 flex-col">
            <span
              id={`${id}-guests-label`}
              className="text-[0.68rem] font-bold uppercase tracking-[0.14em] text-checkin-muted"
            >
              Guests
            </span>
            <output aria-live="polite" className="text-sm font-semibold">
              {guests > 0 ? `${guests} guest${guests === 1 ? "" : "s"}` : "Any"}
            </output>
          </span>
          <span className="flex gap-1">
            <StepButton
              label="Remove a guest"
              disabled={guests === 0}
              onClick={() => setGuests((value) => Math.max(0, value - 1))}
            >
              <Minus />
            </StepButton>
            <StepButton
              label="Add a guest"
              disabled={guests >= MAX_GUESTS}
              onClick={() =>
                setGuests((value) => Math.min(MAX_GUESTS, value + 1))
              }
            >
              <Plus />
            </StepButton>
          </span>
        </div>

        <Button type="submit" variant="signal" className="min-h-14 px-5">
          <Search aria-hidden className="size-4" />
          <span>Search</span>
        </Button>
      </form>
      {dateError ? (
        <p
          role="alert"
          className="px-3 pb-1.5 pt-1 text-sm text-checkin-signal"
        >
          {dateError}
        </p>
      ) : null}
    </Surface>
  );
}

function DateField({
  id,
  label,
  value,
  min,
  max,
  onChange,
}: {
  id: string;
  label: string;
  value: string;
  min?: string;
  max?: string;
  onChange: (value: string) => void;
}) {
  return (
    <label
      htmlFor={id}
      className="flex min-h-14 cursor-text items-center gap-3 rounded-[0.8rem] px-3 transition-colors focus-within:bg-checkin-mist/40 hover:bg-checkin-mist/30 has-[:focus-visible]:ring-3 has-[:focus-visible]:ring-checkin-signal/35"
    >
      <CalendarDays
        aria-hidden
        className="size-4 shrink-0 text-checkin-signal"
      />
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="text-[0.68rem] font-bold uppercase tracking-[0.14em] text-checkin-muted">
          {label}
        </span>
        <input
          id={id}
          type="date"
          value={value}
          min={min}
          max={max}
          onChange={(event) => onChange(event.target.value)}
          className="w-full bg-transparent text-sm font-semibold text-checkin-ink outline-none [color-scheme:light]"
        />
      </span>
    </label>
  );
}

function StepButton({
  label,
  disabled,
  onClick,
  children,
}: {
  label: string;
  disabled: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
      className="grid size-9 pointer-coarse:size-11 place-items-center rounded-full border border-checkin-line text-checkin-ink transition-colors hover:bg-checkin-mist/50 focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-checkin-signal/35 disabled:opacity-35 [&_svg]:size-3.5"
    >
      {children}
    </button>
  );
}
