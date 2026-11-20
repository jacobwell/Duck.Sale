import { z } from "zod";
export const searchInputSchema = z.object({
  query: z.string().trim().min(5).max(1000),
  location: z.string().trim().max(120).default("Anywhere"),
  budget: z.number().nonnegative().max(1_000_000_000).nullable().default(null),
  intent: z.enum(["buy", "rent", "any"]).default("buy"),
});
export type SearchInput = z.infer<typeof searchInputSchema>;
export const listingSchema = z.object({
  title: z.string().max(200),
  sourceUrl: z.string().url(),
  imageUrl: z.string().nullable(),
  location: z.string().max(200).nullable(),
  price: z.number().nonnegative().nullable(),
  currency: z.string().length(3).nullable(),
  priceUnit: z.enum(["total", "hour", "day", "week", "month", "unknown"]),
  status: z.enum(["listed", "sold", "unavailable", "unknown"]),
  description: z.string().max(700),
  highlights: z.array(z.string().max(120)).max(4),
  caveats: z.array(z.string().max(200)).max(5),
  evidence: z.string().max(600),
  priceEvidence: z.string().max(300).nullable(),
  statusEvidence: z.string().max(300).nullable(),
  attributes: z
    .array(
      z.object({
        name: z.string().trim().min(1).max(50),
        value: z.string().trim().min(1).max(120),
        evidence: z.string().trim().min(1).max(240),
      }),
    )
    .max(8)
    .optional(),
  confidence: z.enum(["high", "medium", "low"]),
  matchReason: z.string().max(300),
});
export type ApiCall = {
  id: string;
  service: "Boat.dev" | "Context.dev" | "AI Gateway" | "Geocoder";
  operation: string;
  status: "running" | "complete" | "failed";
  startedAt: string;
  finishedAt?: string;
  statusCode?: number;
  target?: string;
};
export type LocationPoint = {
  latitude: number;
  longitude: number;
  label: string;
  provider: "Open-Meteo / GeoNames";
};
export type Listing = z.infer<typeof listingSchema> & {
  id: string;
  retrievedAt: string;
  source: string;
  sample?: boolean;
  recorded?: boolean;
  imageKind?: "source" | "generated";
  imageStoragePath?: string;
  workerId?: string;
  locationPoint?: LocationPoint;
};
export type WorkerState = {
  id: string;
  name: string;
  query: string;
  status:
    "queued" | "starting" | "searching" | "extracting" | "complete" | "failed";
  sandboxId?: string;
  count?: number;
  partial?: boolean;
  message?: string;
  cleanup?: "stopped" | "ttl-fallback";
  calls?: ApiCall[];
  progress?: {
    discovered: number;
    inspected: number;
    queued: number;
    skipped: number;
    queuePosition?: number;
    cooldownUntil?: string;
  };
  excludeUrls?: string[];
};
export type SearchRun = {
  id: string;
  query: string;
  location: string;
  intent: string;
  budget: number | null;
  status: "running" | "complete" | "partial" | "failed";
  listings: Listing[];
  workers: WorkerState[];
  created_at: string;
  warning?: string;
  sample?: boolean;
  recorded?: boolean;
  parent_run_id?: string | null;
  root_run_id?: string | null;
  voyage_number?: number;
};
export type SearchEvent =
  | { type: "run"; id: string }
  | { type: "worker"; worker: WorkerState }
  | { type: "results"; listings: Listing[] }
  | { type: "complete"; run: SearchRun }
  | { type: "error"; message: string };
export type AppConfig = {
  ready: boolean;
  services: { name: string; configured: boolean }[];
  vision: boolean;
};
export function priceLabel(l: Listing) {
  if (l.price === null) return "Price on request";
  if (!l.currency) return `${l.price.toLocaleString()} · currency unknown`;
  try {
    return (
      new Intl.NumberFormat("en-US", {
        style: "currency",
        currency: l.currency,
        maximumFractionDigits: 0,
      }).format(l.price) +
      (l.priceUnit !== "total" && l.priceUnit !== "unknown"
        ? ` / ${l.priceUnit}`
        : "")
    );
  } catch {
    return `${l.price.toLocaleString()} ${l.currency}`;
  }
}
