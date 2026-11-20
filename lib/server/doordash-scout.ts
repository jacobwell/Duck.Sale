import "server-only";
import { adminDb } from "./db";
import { discoverFood } from "./doordash";
import type { ApiCall, Listing, SearchInput } from "@/lib/types";
export type RetailPlan = {
  query: string;
  kind: "item" | "alternative" | "accessory";
  reason: string;
  city: string;
  region: string | null;
  countryCode: string;
};
export async function doorDashScout(
  runId: string,
  userId: string,
  input: SearchInput,
  plan: RetailPlan,
  signal: AbortSignal,
  record: (call: ApiCall) => Promise<void>,
) {
  const db = adminDb();
  const { data: admission, error } = await db.rpc("admit_food_search", {
    owner: userId,
  });
  if (error)
    throw Error(
      /hourly|busy/.test(error.message)
        ? error.message
        : "DoorDash admission unavailable",
    );
  try {
    const call: ApiCall = {
      id: crypto.randomUUID(),
      service: "Geocoder",
      operation: "resolve DoorDash search city",
      target: plan.city,
      startedAt: new Date().toISOString(),
      status: "running",
    };
    await record(call);
    const url = new URL("https://geocoding-api.open-meteo.com/v1/search");
    url.searchParams.set("name", plan.city);
    url.searchParams.set("countryCode", plan.countryCode);
    url.searchParams.set("count", "10");
    const response = await fetch(url, {
      signal: AbortSignal.any([signal, AbortSignal.timeout(8000)]),
    });
    await record({
      ...call,
      status: response.ok ? "complete" : "failed",
      statusCode: response.status,
      finishedAt: new Date().toISOString(),
    });
    if (!response.ok) throw Error("DoorDash city lookup unavailable");
    const data = await response.json();
    const normalize = (x: string) =>
      x.toLowerCase().normalize("NFD").replace(/\p{M}/gu, "").trim();
    const hits = (data.results || []).filter(
      (p: {
        name: string;
        country_code: string;
        admin1: string;
        latitude: number;
        longitude: number;
      }) =>
        normalize(p.name) === normalize(plan.city) &&
        p.country_code === plan.countryCode &&
        (!plan.region ||
          normalize(p.admin1 || "") === normalize(plan.region)) &&
        Number.isFinite(p.latitude) &&
        Number.isFinite(p.longitude),
    );
    if (hits.length !== 1)
      return {
        listings: [] as Listing[],
        message:
          "DoorDash needs an unambiguous city. Use the retail page to select a city or branch.",
        partial: true,
      };
    const point = hits[0];
    const result = await discoverFood(
      plan.query,
      point.latitude,
      point.longitude,
      signal,
      "retail",
      undefined,
      record,
    );
    const retrievedAt = new Date().toISOString();
    const listings: Listing[] = result.stores
      .filter(
        (s) =>
          input.budget === null ||
          s.price === null ||
          plan.countryCode !== "US" ||
          s.price <= input.budget,
      )
      .map((s) => ({
        id: crypto.randomUUID(),
        workerId: "4",
        retrievedAt,
        source: "DoorDash",
        sourceUrl: s.url,
        title: (plan.kind === "item"
          ? s.name
          : `${plan.kind === "accessory" ? "Accessory" : "Alternative"}: ${s.name}`
        ).slice(0, 200),
        imageUrl: s.image,
        location: null,
        price: s.price,
        currency: plan.countryCode === "US" ? "USD" : null,
        priceUnit: "unknown",
        status: "unknown",
        description:
          `DoorDash catalog result from ${s.storeName}. ${plan.reason}`.slice(
            0,
            700,
          ),
        highlights: [
          `${plan.kind === "item" ? "Item match" : plan.kind === "accessory" ? "Accessory, not the requested item" : "Alternative, not an exact match"}`,
          `Store branch ${s.id.split(":")[0]}`,
        ],
        caveats: [
          "Confirm stock, quantity, final price and delivery on DoorDash.",
          "Search centered on " +
            [plan.city, plan.region].filter(Boolean).join(", ") +
            "; store coordinates not verified.",
          ...(plan.kind !== "item"
            ? [
                "This is a related suggestion, not fulfillment of the original item request.",
              ]
            : []),
        ],
        evidence: JSON.stringify({
          item: s.name,
          store: s.storeName,
          storeId: s.id.split(":")[0],
        }).slice(0, 600),
        priceEvidence:
          s.price === null
            ? null
            : `DoorDash returned listed price ${s.price}; final price and quantity require confirmation.`,
        statusEvidence: null,
        confidence: "medium",
        matchReason: `${plan.kind}: ${plan.reason}`.slice(0, 300),
      }));
    const saved = await db
      .from("source_evidence")
      .insert({
        run_id: runId,
        user_id: userId,
        worker_id: "4",
        evidence: {
          provider: "DoorDash",
          query: plan.query,
          coverage: result.coverage,
          items: result.stores,
        },
      });
    if (saved.error) throw Error("Could not save DoorDash source evidence");
    return {
      listings,
      message: `Server-side DoorDash scout · ${plan.kind}. ${result.coverage?.receipts.join(" · ") || "Catalog search complete"}`,
      partial: !!result.coverage?.receipts.some((s) =>
        /partial|unavailable/.test(s),
      ),
    };
  } finally {
    await db
      .from("food_requests")
      .update({ finished_at: new Date().toISOString() })
      .eq("id", admission);
  }
}
