import { aiService } from "./models";
import "server-only";
import type { ApiCall, Listing, LocationPoint } from "@/lib/types";
import { normalizeLocations } from "./ai";

type Place = {
  city: string;
  region: string | null;
  countryCode: string | null;
  latitude?: number | null;
  longitude?: number | null;
};
type Hit = {
  name: string;
  feature_code?: string;
  latitude: number;
  longitude: number;
  admin1?: string;
  country?: string;
  country_code?: string;
};
const cache = new Map<string, { point: LocationPoint; expires: number }>();
const key = (value: string) =>
  value
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
const cacheKey = (value: string) => value.trim().toLowerCase();
function cached(location: string) {
  const hit = cache.get(cacheKey(location));
  if (hit && hit.expires > Date.now()) return hit.point;
  cache.delete(cacheKey(location));
}
function nearHint(hit: Hit, place: Place) {
  if (place.latitude == null || place.longitude == null) return false;
  const radians = Math.PI / 180;
  const a =
    Math.sin(((hit.latitude - place.latitude) * radians) / 2) ** 2 +
    Math.cos(hit.latitude * radians) *
      Math.cos(place.latitude * radians) *
      Math.sin(((hit.longitude - place.longitude) * radians) / 2) ** 2;
  return 6371 * 2 * Math.asin(Math.sqrt(Math.min(1, a))) <= 25;
}

async function locateListing(
  listing: Listing,
  place: Place,
  signal: AbortSignal,
  record: (call: ApiCall) => Promise<void>,
): Promise<Listing> {
  const location = listing.location!.trim();
  const query = [place.city, place.region].filter(Boolean).join(", ");
  const call: ApiCall = {
    id: crypto.randomUUID(),
    service: "Geocoder",
    operation: "city → coordinates",
    target: query,
    startedAt: new Date().toISOString(),
    status: "running",
  };
  await record(call);
  try {
    const url = new URL(
      process.env.OPEN_METEO_API_KEY
        ? "https://customer-geocoding-api.open-meteo.com/v1/search"
        : "https://geocoding-api.open-meteo.com/v1/search",
    );
    url.searchParams.set("name", query);
    url.searchParams.set("count", "10");
    url.searchParams.set("language", "en");
    if (place.countryCode)
      url.searchParams.set("countryCode", place.countryCode);
    if (process.env.OPEN_METEO_API_KEY)
      url.searchParams.set("apikey", process.env.OPEN_METEO_API_KEY);
    const response = await fetch(url, {
      signal: AbortSignal.any([signal, AbortSignal.timeout(8000)]),
    });
    if (!response.ok) {
      await record({
        ...call,
        status: "failed",
        statusCode: response.status,
        finishedAt: new Date().toISOString(),
      });
      return listing;
    }
    const data = (await response.json()) as { results?: Hit[] };
    const matches = (data.results || []).filter(
      (h) =>
        h.feature_code?.startsWith("PPL") &&
        key(h.name) === key(place.city) &&
        (!place.region || key(h.admin1 || "") === key(place.region)) &&
        (!place.countryCode || h.country_code === place.countryCode) &&
        Number.isFinite(h.latitude) &&
        Math.abs(h.latitude) <= 90 &&
        Number.isFinite(h.longitude) &&
        Math.abs(h.longitude) <= 180,
    );
    // A comma alone is not evidence of which city was intended.
    const unique = [
      ...new Map(
        matches.map((h) => [`${h.latitude},${h.longitude}`, h]),
      ).values(),
    ];
    const nearby = unique.filter((h) => nearHint(h, place));
    const hit =
      unique.length === 1
        ? unique[0]
        : nearby.length === 1
          ? nearby[0]
          : undefined;
    const point: LocationPoint | undefined = hit
      ? {
          latitude: hit.latitude,
          longitude: hit.longitude,
          label: [hit.name, hit.admin1, hit.country].filter(Boolean).join(", "),
          provider: "Open-Meteo / GeoNames",
        }
      : undefined;
    if (point) {
      if (cache.size >= 500) cache.delete(cache.keys().next().value!);
      cache.set(cacheKey(location), {
        point,
        expires: Date.now() + 24 * 60 * 60 * 1000,
      });
    }
    await record({
      ...call,
      status: "complete",
      statusCode: response.status,
      finishedAt: new Date().toISOString(),
    });
    return point ? { ...listing, locationPoint: point } : listing;
  } catch {
    await record({
      ...call,
      status: "failed",
      finishedAt: new Date().toISOString(),
    });
    return listing;
  }
}

export async function locateListings(
  listings: Listing[],
  runId: string,
  userId: string,
  signal: AbortSignal,
  record: (call: ApiCall) => Promise<void>,
): Promise<Listing[]> {
  const ready = listings.map((listing) => {
    if (listing.locationPoint || !listing.location?.trim()) return listing;
    const point = cached(listing.location);
    return point ? { ...listing, locationPoint: point } : listing;
  });
  const locations = [
    ...new Set(
      ready
        .filter((l) => !l.locationPoint && l.location?.trim())
        .map((l) => l.location!.trim()),
    ),
  ];
  if (!locations.length || signal.aborted) return ready;
  // One recorded generation per batch, not one model request per result.
  const places = new Map<string, Place>();
  for (let offset = 0; offset < locations.length; offset += 12) {
    const batch = locations.slice(offset, offset + 12);
    const call: ApiCall = {
      id: crypto.randomUUID(),
      service: aiService(),
      operation: "normalize listing locations",
      target: batch.join(" · "),
      startedAt: new Date().toISOString(),
      status: "running",
    };
    await record(call);
    try {
      const result = await normalizeLocations(runId, userId, batch, signal);
      for (const location of batch) {
        const matches = result.locations.filter((p) => p.original === location);
        const p = matches.length === 1 ? matches[0] : undefined;
        if (p?.city?.trim())
          places.set(location, {
            city: p.city.trim(),
            region: p.region?.trim() || null,
            countryCode: p.countryCode,
            latitude: p.latitude,
            longitude: p.longitude,
          });
      }
      await record({
        ...call,
        status: "complete",
        finishedAt: new Date().toISOString(),
      });
    } catch {
      await record({
        ...call,
        status: "failed",
        finishedAt: new Date().toISOString(),
      });
      // Keep useful results even during a model outage. Only an exact, unique
      // city-name match can succeed without AI normalization.
      for (const location of batch)
        places.set(location, {
          city: location,
          region: null,
          countryCode: null,
        });
    }
  }
  const resolved = new Map<string, Listing>();
  for (const listing of ready) {
    const location = listing.location?.trim();
    if (listing.locationPoint || !location) continue;
    const place = places.get(location);
    if (!place) continue;
    const earlier = resolved.get(location);
    if (earlier) continue;
    resolved.set(location, await locateListing(listing, place, signal, record));
  }
  return ready.map((listing) => {
    const point = resolved.get(listing.location?.trim() || "")?.locationPoint;
    return point && !listing.locationPoint
      ? { ...listing, locationPoint: point }
      : listing;
  });
}
