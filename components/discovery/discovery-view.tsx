"use client";

import { useConvexAuth, useQuery } from "convex/react";
import { List, Map as MapIcon, RotateCcw, SearchX } from "lucide-react";
import dynamic from "next/dynamic";
import { useEffect, useMemo, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { api } from "@/convex/_generated/api";
import { sortLabels } from "@/lib/discovery/catalog";
import {
  seededOrigin,
  serializeDiscoveryParams,
  toSearchInput,
} from "@/lib/discovery/discovery-params";
import type { SearchSort } from "@/lib/search/search-contract";
import { cn } from "@/lib/utils";
import { CategoryPills } from "./category-pills";
import { FiltersDialog } from "./filters-dialog";
import { ListingCard } from "./listing-card";
import { SearchBar } from "./search-bar";
import { useDiscoveryFilters } from "./use-discovery-filters";
import { useSearchResults } from "./use-search-results";

const ResultsMap = dynamic(
  () => import("./results-map").then((module) => module.ResultsMap),
  {
    ssr: false,
    loading: () => (
      <div className="grid size-full place-items-center rounded-[1.25rem] border border-checkin-line bg-checkin-mist/40 text-sm text-checkin-muted">
        Loading map…
      </div>
    ),
  },
);

export function DiscoveryView() {
  const { filters, setFilters, updateFilters } = useDiscoveryFilters();
  const input = useMemo(() => toSearchInput(filters), [filters]);
  const search = useSearchResults(input);
  const { isAuthenticated } = useConvexAuth();
  const [hoveredId, setHoveredId] = useState<string>();
  const [selectedId, setSelectedId] = useState<string>();
  const view = filters.view ?? "list";
  const sentinelRef = useRef<HTMLDivElement>(null);

  const listingIds = useMemo(
    () => search.results.map((result) => result.listingId),
    [search.results],
  );
  const saved = useQuery(
    api.dashboard.savedListingIds,
    isAuthenticated && listingIds.length > 0 ? { listingIds } : "skip",
  );
  const savedIds = useMemo(() => new Set<string>(saved ?? []), [saved]);

  // Infinite scroll: load the next page as the end of the list approaches.
  const { canLoadMore, loadMore } = search;
  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel || !canLoadMore) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) loadMore();
      },
      { rootMargin: "600px 0px" },
    );
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [canLoadMore, loadMore]);

  const searchKey = serializeDiscoveryParams({
    amenities: [],
    where: filters.where,
    checkIn: filters.checkIn,
    checkOut: filters.checkOut,
    guests: filters.guests,
    near: filters.near,
  });
  const hasOrigin = Boolean(filters.near ?? seededOrigin(filters.where));
  const activeId = hoveredId ?? selectedId;
  const stayQuery =
    filters.checkIn && filters.checkOut
      ? `?${new URLSearchParams({
          checkIn: filters.checkIn,
          checkOut: filters.checkOut,
          ...(filters.guests ? { guests: String(filters.guests) } : {}),
        })}`
      : "";

  function selectFromMap(listingId: string) {
    setSelectedId(listingId);
    updateFilters({ view: undefined });
    window.requestAnimationFrame(() =>
      document
        .getElementById(`listing-${listingId}`)
        ?.scrollIntoView({ behavior: "smooth", block: "center" }),
    );
  }

  function resetFilters() {
    setFilters({ amenities: [], view: filters.view });
  }

  return (
    <main className="mx-auto flex w-full max-w-[90rem] flex-1 flex-col px-4 pb-16 pt-6 sm:px-6 lg:px-8">
      <h1 className="sr-only">Find a stay</h1>
      <SearchBar key={searchKey} filters={filters} onSearch={updateFilters} />

      <div className="mt-5 flex items-center gap-3">
        <div className="min-w-0 flex-1">
          <CategoryPills
            selected={filters.category}
            onSelect={(category) => updateFilters({ category })}
          />
        </div>
        <FiltersDialog filters={filters} onApply={updateFilters} />
      </div>

      <div className="mt-6 grid flex-1 gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(22rem,0.72fr)]">
        <section
          aria-labelledby="results-heading"
          className={cn(
            "@container/results min-w-0",
            view === "map" && "max-lg:hidden",
          )}
        >
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <h2
              id="results-heading"
              aria-live="polite"
              className="text-lg font-semibold tracking-[-0.03em]"
            >
              {resultsHeading(search.status, search.total, filters.where)}
            </h2>
            <label className="flex items-center gap-2 text-sm">
              <span className="text-checkin-muted">Sort</span>
              <select
                value={filters.sort ?? "rating"}
                onChange={(event) =>
                  updateFilters({
                    sort:
                      event.target.value === "rating"
                        ? undefined
                        : (event.target.value as SearchSort),
                  })
                }
                className="min-h-11 rounded-[0.7rem] border border-checkin-line bg-checkin-paper px-3 font-semibold focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-checkin-signal/35"
              >
                {(Object.keys(sortLabels) as SearchSort[]).map((sort) => (
                  <option
                    key={sort}
                    value={sort}
                    disabled={sort === "distance" && !hasOrigin}
                  >
                    {sortLabels[sort]}
                    {sort === "distance" && !hasOrigin
                      ? " (pick a destination)"
                      : ""}
                  </option>
                ))}
              </select>
            </label>
          </div>

          {search.status === "error" && search.results.length === 0 ? (
            <SearchProblem
              code={search.error?.code}
              message={search.error?.message}
              onRetry={search.retry}
              onReset={resetFilters}
            />
          ) : search.status === "loading" && search.results.length === 0 ? (
            <ResultsSkeleton />
          ) : search.results.length === 0 ? (
            <EmptyResults onReset={resetFilters} />
          ) : (
            <>
              <ul className="grid gap-x-5 gap-y-9 @xl/results:grid-cols-2 @4xl/results:grid-cols-3">
                {search.results.map((listing, index) => (
                  <li key={listing.listingId}>
                    <ListingCard
                      listing={listing}
                      href={`/listings/${listing.listingId}${stayQuery}`}
                      saved={savedIds.has(listing.listingId)}
                      active={activeId === listing.listingId}
                      preload={index < 3}
                      onHoverChange={(hovered) =>
                        setHoveredId(hovered ? listing.listingId : undefined)
                      }
                    />
                  </li>
                ))}
              </ul>
              <div ref={sentinelRef} aria-hidden className="h-px" />
              <div className="mt-10 flex flex-col items-center gap-2">
                {search.status === "error" ? (
                  <>
                    <p role="alert" className="text-sm text-checkin-signal">
                      {search.error?.message}
                    </p>
                    <Button variant="outline" onClick={search.retry}>
                      <RotateCcw aria-hidden className="size-4" />
                      Try again
                    </Button>
                  </>
                ) : search.canLoadMore || search.isLoadingMore ? (
                  <Button
                    variant="outline"
                    onClick={search.loadMore}
                    disabled={search.isLoadingMore}
                  >
                    {search.isLoadingMore
                      ? "Loading more stays…"
                      : "Load more stays"}
                  </Button>
                ) : (
                  <p className="text-sm text-checkin-muted">
                    You&apos;ve seen all {search.total}{" "}
                    {search.total === 1 ? "stay" : "stays"}.
                  </p>
                )}
              </div>
            </>
          )}
        </section>

        <aside
          aria-label="Map"
          className={cn(
            "lg:sticky lg:top-24 lg:h-[calc(100dvh-7.5rem)]",
            view === "list"
              ? "max-lg:hidden"
              : "h-[calc(100dvh-12rem)] min-h-[24rem]",
          )}
        >
          <ResultsMap
            results={search.results}
            activeId={activeId}
            onActiveChange={setHoveredId}
            onSelect={selectFromMap}
            onDestination={(city) =>
              updateFilters({ where: city, near: undefined, sort: undefined })
            }
          />
        </aside>
      </div>

      <div className="pointer-events-none fixed inset-x-0 bottom-[calc(1.5rem+env(safe-area-inset-bottom))] z-40 flex justify-center lg:hidden">
        <Button
          onClick={() =>
            updateFilters({ view: view === "list" ? "map" : undefined })
          }
          className="pointer-events-auto rounded-full px-5 shadow-[0_12px_30px_rgb(23_35_31/0.3)]"
        >
          {view === "list" ? (
            <>
              <MapIcon aria-hidden className="size-4" /> Show map
            </>
          ) : (
            <>
              <List aria-hidden className="size-4" /> Show list
            </>
          )}
        </Button>
      </div>
    </main>
  );
}

function resultsHeading(
  status: "loading" | "ready" | "error",
  total: number,
  where: string | undefined,
) {
  if (status === "loading") return "Finding stays…";
  if (status === "error") return "Search unavailable";
  const place = where
    ? ` in ${where.replace(/\b\w/g, (letter) => letter.toUpperCase())}`
    : "";
  return `${total} ${total === 1 ? "stay" : "stays"}${place}`;
}

function ResultsSkeleton() {
  return (
    <ul
      aria-hidden
      className="grid gap-x-5 gap-y-9 @xl/results:grid-cols-2 @4xl/results:grid-cols-3"
    >
      {Array.from({ length: 6 }, (_, index) => (
        <li key={index} className="space-y-3">
          <div className="aspect-[20/19] animate-pulse rounded-[1.1rem] bg-checkin-mist/70 motion-reduce:animate-none" />
          <div className="h-4 w-2/3 rounded bg-checkin-mist/70" />
          <div className="h-4 w-1/3 rounded bg-checkin-mist/50" />
        </li>
      ))}
    </ul>
  );
}

function EmptyResults({ onReset }: { onReset: () => void }) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-[1.25rem] border border-dashed border-checkin-line px-6 py-16 text-center">
      <SearchX aria-hidden className="size-7 text-checkin-muted" />
      <p className="font-semibold">No stays match these filters</p>
      <p className="max-w-sm text-sm text-checkin-muted">
        Try other dates, fewer filters, or a different destination.
      </p>
      <Button variant="outline" onClick={onReset}>
        Clear all filters
      </Button>
    </div>
  );
}

function SearchProblem({
  code,
  message,
  onRetry,
  onReset,
}: {
  code: string | undefined;
  message: string | undefined;
  onRetry: () => void;
  onReset: () => void;
}) {
  const fixable = code === "SEARCH_TOO_BROAD" || code === "INVALID_SEARCH";
  return (
    <div
      role="alert"
      className="flex flex-col items-center gap-3 rounded-[1.25rem] border border-checkin-line bg-checkin-paper px-6 py-16 text-center"
    >
      <p className="font-semibold">
        {code === "SEARCH_TOO_BROAD"
          ? "That search is too broad"
          : fixable
            ? "We couldn't run that search"
            : "Search is unavailable right now"}
      </p>
      <p className="max-w-sm text-sm text-checkin-muted">{message}</p>
      {fixable ? (
        <Button variant="outline" onClick={onReset}>
          Start over
        </Button>
      ) : (
        <Button variant="outline" onClick={onRetry}>
          <RotateCcw aria-hidden className="size-4" />
          Try again
        </Button>
      )}
    </div>
  );
}
