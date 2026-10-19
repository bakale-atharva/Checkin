"use client";

import "mapbox-gl/dist/mapbox-gl.css";

import type { Map as MapboxMap, Marker } from "mapbox-gl";
import { MapPinOff } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { mapboxToken } from "@/lib/discovery/geocoding";

const MAP_LOAD_TIMEOUT_MS = 12_000;

type Pin = { latitude: number; longitude: number };
type MapStatus = "loading" | "ready" | "unavailable";

/**
 * Lets a host drop or drag their listing pin. Without Mapbox, the coordinate
 * fields beside it remain the way to position the pin.
 */
export function LocationPinPicker({
  pin,
  onChange,
}: {
  pin: Pin;
  onChange: (pin: Pin) => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapboxMap | null>(null);
  const markerRef = useRef<Marker | null>(null);
  const onChangeRef = useRef(onChange);
  const initialPin = useRef(pin);
  const [status, setStatus] = useState<MapStatus>(
    mapboxToken ? "loading" : "unavailable",
  );

  useEffect(() => {
    onChangeRef.current = onChange;
  });

  useEffect(() => {
    if (!mapboxToken || !containerRef.current) return;
    let cancelled = false;
    let map: MapboxMap | null = null;
    const timeout = window.setTimeout(() => {
      if (!cancelled && !map?.loaded()) setStatus("unavailable");
    }, MAP_LOAD_TIMEOUT_MS);

    import("mapbox-gl")
      .then(({ default: mapboxgl }) => {
        if (cancelled || !containerRef.current) return;
        mapboxgl.accessToken = mapboxToken!;
        const start = initialPin.current;
        const hasPin = start.latitude !== 0 || start.longitude !== 0;
        map = new mapboxgl.Map({
          container: containerRef.current,
          style: "mapbox://styles/mapbox/light-v11",
          center: hasPin ? [start.longitude, start.latitude] : [0, 20],
          zoom: hasPin ? 12 : 1.4,
        });
        map.addControl(
          new mapboxgl.NavigationControl({ showCompass: false }),
          "top-right",
        );
        const marker = new mapboxgl.Marker({
          draggable: true,
          color: "#b4502f",
        }).setLngLat([start.longitude, start.latitude]);
        if (hasPin) marker.addTo(map);
        marker.on("dragend", () => {
          const { lat, lng } = marker.getLngLat();
          onChangeRef.current({ latitude: lat, longitude: lng });
        });
        map.on("click", (event) => {
          marker.setLngLat(event.lngLat);
          if (map) marker.addTo(map);
          onChangeRef.current({
            latitude: event.lngLat.lat,
            longitude: event.lngLat.lng,
          });
        });
        map.on("load", () => {
          if (!cancelled) setStatus("ready");
        });
        map.on("error", (event) => {
          if (!cancelled && !map?.loaded()) {
            console.warn("Map unavailable:", event.error?.message);
            setStatus("unavailable");
          }
        });
        mapRef.current = map;
        markerRef.current = marker;
      })
      .catch(() => {
        if (!cancelled) setStatus("unavailable");
      });

    return () => {
      cancelled = true;
      window.clearTimeout(timeout);
      markerRef.current?.remove();
      map?.remove();
      mapRef.current = null;
      markerRef.current = null;
    };
  }, []);

  // Follow pins typed into the coordinate fields.
  useEffect(() => {
    const map = mapRef.current;
    const marker = markerRef.current;
    if (status !== "ready" || !map || !marker) return;
    if (pin.latitude === 0 && pin.longitude === 0) return;
    const current = marker.getLngLat();
    if (current.lat === pin.latitude && current.lng === pin.longitude) return;
    marker.setLngLat([pin.longitude, pin.latitude]).addTo(map);
    map.easeTo({ center: [pin.longitude, pin.latitude], zoom: 12 });
  }, [pin.latitude, pin.longitude, status]);

  return (
    <div className="relative aspect-[4/3] w-full overflow-hidden rounded-[1rem] border border-checkin-line bg-checkin-mist/40 sm:aspect-[16/9]">
      <div
        ref={containerRef}
        className="absolute inset-0"
        aria-label="Map: click to place your listing pin, or drag the pin to adjust it"
        role="application"
        hidden={status === "unavailable"}
      />
      {status === "loading" ? (
        <p className="absolute inset-x-0 bottom-3 text-center text-xs text-checkin-muted">
          Loading map…
        </p>
      ) : null}
      {status === "unavailable" ? (
        <div className="absolute inset-0 grid place-items-center p-6 text-center">
          <div className="flex max-w-xs flex-col items-center gap-2">
            <MapPinOff aria-hidden className="size-6 text-checkin-muted" />
            <p className="text-sm font-semibold">Map unavailable</p>
            <p className="text-xs text-checkin-muted">
              Enter the latitude and longitude instead — the pin works the same
              way.
            </p>
          </div>
        </div>
      ) : null}
    </div>
  );
}
