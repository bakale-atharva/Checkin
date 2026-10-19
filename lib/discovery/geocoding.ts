export type DestinationSuggestion = {
  city: string;
  label: string;
  latitude: number;
  longitude: number;
  source: "seeded" | "mapbox";
};

type MapboxFeature = {
  properties?: {
    name?: string;
    full_address?: string;
    place_formatted?: string;
    coordinates?: { latitude?: number; longitude?: number };
  };
};

/**
 * Forward-geocodes a place name with Mapbox. Results are transient: callers
 * keep them in component state only and never persist them.
 */
export async function geocodePlaces(
  query: string,
  accessToken: string,
  signal: AbortSignal,
): Promise<DestinationSuggestion[]> {
  const url = new URL("https://api.mapbox.com/search/geocode/v6/forward");
  url.searchParams.set("q", query);
  url.searchParams.set("types", "place");
  url.searchParams.set("limit", "5");
  url.searchParams.set("language", "en");
  url.searchParams.set("access_token", accessToken);

  const response = await fetch(url, { signal });
  if (!response.ok) throw new Error(`Geocoding failed (${response.status}).`);
  const body = (await response.json()) as { features?: MapboxFeature[] };

  return (body.features ?? []).flatMap((feature) => {
    const name = feature.properties?.name;
    const latitude = feature.properties?.coordinates?.latitude;
    const longitude = feature.properties?.coordinates?.longitude;
    if (!name || latitude === undefined || longitude === undefined) return [];
    return [
      {
        city: name,
        label: feature.properties?.place_formatted
          ? `${name}, ${feature.properties.place_formatted}`
          : name,
        latitude,
        longitude,
        source: "mapbox" as const,
      },
    ];
  });
}

export const mapboxToken = process.env.NEXT_PUBLIC_MAPBOX_TOKEN || undefined;
