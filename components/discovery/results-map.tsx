"use client";

import "mapbox-gl/dist/mapbox-gl.css";

import type { Map as MapboxMap, Marker } from "mapbox-gl";
import { MapPinOff } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { formatNightlyPrice } from "@/lib/discovery/catalog";
import { mapboxToken } from "@/lib/discovery/geocoding";
import { seededDestinations } from "@/lib/search/seeded-destinations";
import type { SearchResult } from "./use-search-results";

const MAP_LOAD_TIMEOUT_MS = 12_000;
const MARKER_BASE =
  "rounded-full border px-2.5 py-1 text-xs font-bold shadow-[0_4px_12px_rgb(23_35_31/0.18)] transition-transform focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-checkin-signal/50";
const MARKER_IDLE = [
  "border-checkin-line",
  "bg-checkin-paper",
  "text-checkin-ink",
];
const MARKER_ACTIVE = [
  "scale-110",
  "border-checkin-ink",
  "bg-checkin-ink",
  "text-checkin-canvas",
];

function paintMarker(element: HTMLElement, active: boolean) {
  for (const name of MARKER_IDLE) element.classList.toggle(name, !active);
  for (const name of MARKER_ACTIVE) element.classList.toggle(name, active);
  element.style.setProperty("z-index", active ? "2" : "");
  if (active) element.setAttribute("aria-current", "true");
  else element.removeAttribute("aria-current");
}

type MapStatus = "loading" | "ready" | "unavailable";

/**
 * Mapbox map of the loaded results. Pins and cards share hover/selection state.
 * Without a token, or when Mapbox fails to load, it renders a fallback panel and
 * the list keeps working.
 */
export function ResultsMap({
  results,
  activeId,
  onActiveChange,
  onSelect,
  onDestination,
}: {
  results: SearchResult[];
  activeId: string | undefined;
  onActiveChange: (listingId: string | undefined) => void;
  onSelect: (listingId: string) => void;
  onDestination: (city: string) => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapboxMap | null>(null);
  const markersRef = useRef(
    new Map<string, { marker: Marker; element: HTMLButtonElement }>(),
  );
  const libraryRef = useRef<typeof import("mapbox-gl").default | null>(null);
  const callbacks = useRef({ onActiveChange, onSelect });
  const [status, setStatus] = useState<MapStatus>(
    mapboxToken ? "loading" : "unavailable",
  );

  useEffect(() => {
    callbacks.current = { onActiveChange, onSelect };
  });

  useEffect(() => {
    if (!mapboxToken || !containerRef.current) return;
    let cancelled = false;
    let map: MapboxMap | null = null;
    const markers = markersRef.current;
    const timeout = window.setTimeout(() => {
      if (!cancelled && !map?.loaded()) setStatus("unavailable");
    }, MAP_LOAD_TIMEOUT_MS);

    import("mapbox-gl")
      .then(({ default: mapboxgl }) => {
        if (cancelled || !containerRef.current) return;
        libraryRef.current = mapboxgl;
        mapboxgl.accessToken = mapboxToken!;
        map = new mapboxgl.Map({
          container: containerRef.current,
          style: "mapbox://styles/mapbox/light-v11",
          center: [0, 20],
          zoom: 1.4,
          attributionControl: true,
          cooperativeGestures: false,
        });
        map.addControl(
          new mapboxgl.NavigationControl({ showCompass: false }),
          "top-right",
        );
        map.on("load", () => {
          if (!cancelled) setStatus("ready");
        });
        map.on("error", (event) => {
          // Authentication or style failures before the first render mean the service is unusable.
          if (!cancelled && !map?.loaded()) {
            console.warn("Map unavailable:", event.error?.message);
            setStatus("unavailable");
          }
        });
        mapRef.current = map;
      })
      .catch(() => {
        if (!cancelled) setStatus("unavailable");
      });

    return () => {
      cancelled = true;
      window.clearTimeout(timeout);
      markers.forEach(({ marker }) => marker.remove());
      markers.clear();
      map?.remove();
      mapRef.current = null;
    };
  }, []);

  // Keep pins in step with the loaded results.
  useEffect(() => {
    const map = mapRef.current;
    const mapboxgl = libraryRef.current;
    if (status !== "ready" || !map || !mapboxgl) return;
    const markers = markersRef.current;
    const wanted = new Set(results.map((result) => String(result.listingId)));

    for (const [listingId, { marker }] of markers) {
      if (!wanted.has(listingId)) {
        marker.remove();
        markers.delete(listingId);
      }
    }
    for (const result of results) {
      const listingId = String(result.listingId);
      if (markers.has(listingId)) continue;
      const element = document.createElement("button");
      element.type = "button";
      element.className = MARKER_BASE;
      paintMarker(element, false);
      element.textContent = formatNightlyPrice(result.nightlyPriceCents);
      element.setAttribute(
        "aria-label",
        `${result.title}, ${formatNightlyPrice(result.nightlyPriceCents)} per night`,
      );
      element.addEventListener("pointerenter", () =>
        callbacks.current.onActiveChange(listingId),
      );
      element.addEventListener("pointerleave", () =>
        callbacks.current.onActiveChange(undefined),
      );
      element.addEventListener("focus", () =>
        callbacks.current.onActiveChange(listingId),
      );
      element.addEventListener("blur", () =>
        callbacks.current.onActiveChange(undefined),
      );
      element.addEventListener("click", (event) => {
        event.stopPropagation();
        callbacks.current.onSelect(listingId);
      });
      const marker = new mapboxgl.Marker({ element })
        .setLngLat([result.longitude, result.latitude])
        .addTo(map);
      markers.set(listingId, { marker, element });
    }

    if (results.length > 0) {
      const bounds = new mapboxgl.LngLatBounds();
      for (const result of results)
        bounds.extend([result.longitude, result.latitude]);
      map.fitBounds(bounds, { padding: 64, maxZoom: 13, duration: 600 });
    }
  }, [results, status]);

  // Highlight the pin that matches the hovered or selected card.
  useEffect(() => {
    for (const [listingId, { element }] of markersRef.current)
      paintMarker(element, listingId === activeId);
  }, [activeId, results, status]);

  return (
    <div className="relative size-full overflow-hidden rounded-[1.25rem] border border-checkin-line bg-checkin-mist/40">
      <div
        ref={containerRef}
        role="region"
        aria-label="Map of stays"
        hidden={status === "unavailable"}
        className="size-full"
      />
      {status === "loading" ? (
        <div className="absolute inset-0 grid place-items-center text-sm text-checkin-muted">
          Loading map…
        </div>
      ) : null}
      {status === "unavailable" ? (
        <MapUnavailable onDestination={onDestination} />
      ) : null}
    </div>
  );
}

function MapUnavailable({
  onDestination,
}: {
  onDestination: (city: string) => void;
}) {
  return (
    <div
      role="status"
      className="absolute inset-0 flex flex-col items-center justify-center gap-4 p-6 text-center"
    >
      <span className="grid size-12 place-items-center rounded-full bg-checkin-paper text-checkin-muted">
        <MapPinOff aria-hidden className="size-5" />
      </span>
      <div className="space-y-1">
        <p className="font-semibold">The map is unavailable right now</p>
        <p className="max-w-xs text-sm text-checkin-muted">
          Every stay is still in the list. Jump to a popular destination
          instead.
        </p>
      </div>
      <ul className="flex flex-wrap justify-center gap-2">
        {seededDestinations.map((destination) => (
          <li key={destination.city}>
            <button
              type="button"
              onClick={() => onDestination(destination.city)}
              className="min-h-11 rounded-full border border-checkin-line bg-checkin-paper px-4 text-sm font-semibold hover:border-checkin-ink/40 focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-checkin-signal/35"
            >
              {destination.city}
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
