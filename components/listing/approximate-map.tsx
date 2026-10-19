"use client";

import "mapbox-gl/dist/mapbox-gl.css";

import { MapPinOff } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { mapboxToken } from "@/lib/discovery/geocoding";

const MAP_LOAD_TIMEOUT_MS = 12_000;

/**
 * A map centred on the listing's public (approximate) location with a soft
 * area marker instead of a pin. Falls back to a text description when Mapbox
 * is unconfigured or fails to load.
 */
export function ApproximateMap({
  latitude,
  longitude,
  place,
}: {
  latitude: number;
  longitude: number;
  place: string;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "unavailable">(
    mapboxToken ? "loading" : "unavailable",
  );

  useEffect(() => {
    if (!mapboxToken || !containerRef.current) return;
    let cancelled = false;
    let map: import("mapbox-gl").Map | null = null;
    const timeout = window.setTimeout(() => {
      if (!cancelled && !map?.loaded()) setStatus("unavailable");
    }, MAP_LOAD_TIMEOUT_MS);

    import("mapbox-gl")
      .then(({ default: mapboxgl }) => {
        if (cancelled || !containerRef.current) return;
        mapboxgl.accessToken = mapboxToken!;
        map = new mapboxgl.Map({
          container: containerRef.current,
          style: "mapbox://styles/mapbox/light-v11",
          center: [longitude, latitude],
          zoom: 12.5,
          cooperativeGestures: true,
        });
        map.addControl(
          new mapboxgl.NavigationControl({ showCompass: false }),
          "top-right",
        );
        const area = document.createElement("div");
        area.setAttribute("aria-hidden", "true");
        area.className =
          "size-28 rounded-full border-2 border-checkin-signal/70 bg-checkin-signal/20";
        new mapboxgl.Marker({ element: area })
          .setLngLat([longitude, latitude])
          .addTo(map);
        map.on("load", () => {
          if (!cancelled) setStatus("ready");
        });
        map.on("error", () => {
          if (!cancelled && !map?.loaded()) setStatus("unavailable");
        });
      })
      .catch(() => {
        if (!cancelled) setStatus("unavailable");
      });

    return () => {
      cancelled = true;
      window.clearTimeout(timeout);
      map?.remove();
    };
  }, [latitude, longitude]);

  return (
    <div className="relative aspect-[16/9] overflow-hidden rounded-[1.25rem] border border-checkin-line bg-checkin-mist/40 max-sm:aspect-square">
      <div
        ref={containerRef}
        role="region"
        aria-label={`Map of the area around ${place}`}
        hidden={status === "unavailable"}
        className="size-full"
      />
      {status === "loading" ? (
        <div className="absolute inset-0 grid place-items-center text-sm text-checkin-muted">
          Loading map…
        </div>
      ) : null}
      {status === "unavailable" ? (
        <div
          role="status"
          className="absolute inset-0 flex flex-col items-center justify-center gap-2 p-6 text-center"
        >
          <MapPinOff aria-hidden className="size-6 text-checkin-muted" />
          <p className="font-semibold">The map is unavailable right now</p>
          <p className="max-w-xs text-sm text-checkin-muted">
            This stay is in {place}. The exact address is shared after your
            booking is confirmed.
          </p>
        </div>
      ) : null}
    </div>
  );
}
