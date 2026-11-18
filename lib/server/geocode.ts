import "server-only";
import type { ApiCall, Listing, LocationPoint } from "@/lib/types";
const cache = new Map<string, LocationPoint | null>();
export async function locateListing(
  listing: Listing,
  signal: AbortSignal,
  record: (call: ApiCall) => Promise<void>,
): Promise<Listing> {
  const location = listing.location?.trim();
  if (
    !location ||
    /^(online|anywhere|united states|usa|us|nationwide|worldwide|california)$/i.test(
      location,
    )
  )
    return listing;
  const cacheKey = location.toLocaleLowerCase();
  if (cache.has(cacheKey))
    return { ...listing, locationPoint: cache.get(cacheKey) || undefined };
  const call: ApiCall = {
    id: crypto.randomUUID(),
    service: "Geocoder",
    operation: "city → coordinates",
    target: location,
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
    url.searchParams.set(
      "name",
      location.replace(/\s+\d{5}(?:-\d{4})?(?=,|$)/g, ""),
    );
    url.searchParams.set("count", "3");
    url.searchParams.set("language", "en");
    if (process.env.OPEN_METEO_API_KEY)
      url.searchParams.set("apikey", process.env.OPEN_METEO_API_KEY);
    const r = await fetch(url, {
      signal: AbortSignal.any([signal, AbortSignal.timeout(6000)]),
    });
    if (!r.ok) {
      await record({
        ...call,
        status: "failed",
        statusCode: r.status,
        finishedAt: new Date().toISOString(),
      });
      return listing;
    }
    const data = await r.json();
    const hits = data.results as
      | {
          name: string;
          feature_code?: string;
          latitude: number;
          longitude: number;
          admin1?: string;
          country?: string;
        }[]
      | undefined;
    const cityHits = hits?.filter((h) => h.feature_code?.startsWith("PPL"));
    const first = cityHits?.[0];
    // Unqualified ambiguous city names stay unplaced. No invented coordinates.
    let point: LocationPoint | null = null;
    if (
      first &&
      (cityHits!.length === 1 || location.includes(",")) &&
      Number.isFinite(first.latitude) &&
      Number.isFinite(first.longitude) &&
      Math.abs(first.latitude) <= 90 &&
      Math.abs(first.longitude) <= 180
    ) {
      point = {
        latitude: first.latitude,
        longitude: first.longitude,
        label: [first.name, first.admin1, first.country]
          .filter(Boolean)
          .join(", "),
        provider: "Open-Meteo / GeoNames",
      };
    }
    if (cache.size > 200) cache.clear();
    cache.set(cacheKey, point);
    await record({
      ...call,
      status: "complete",
      statusCode: r.status,
      finishedAt: new Date().toISOString(),
    });
    return { ...listing, locationPoint: point || undefined };
  } catch {
    await record({
      ...call,
      status: "failed",
      finishedAt: new Date().toISOString(),
    });
    return listing;
  }
}
