import "server-only";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import path from "node:path";
import { z } from "zod";
const execute = promisify(execFile);
const storeSchema = z.object({
  store_id: z.string().regex(/^\d+$/),
  name: z.string().min(1).max(300),
  image_url: z.string().optional().nullable(),
  distance: z.string().max(40).optional().nullable(),
  rating: z.number().min(0).max(5).optional().nullable(),
  review_count: z.number().int().nonnegative().optional().nullable(),
  offers_pickup: z.boolean().optional().nullable(),
});
export function foodReady() {
  const expiry = Date.parse(process.env.DOORDASH_TOKEN_EXPIRES_AT || "");
  return (
    process.env.DOORDASH_DISCOVERY_ENABLED === "true" &&
    !!process.env.DD_CLI_ACCESS_TOKEN &&
    Number.isFinite(expiry) &&
    expiry > Date.now() + 60000
  );
}
export async function discoverFood(
  query: string,
  latitude: number,
  longitude: number,
  signal: AbortSignal,
) {
  if (!foodReady()) throw Error("unavailable");
  const bin =
    process.platform === "linux"
      ? path.join(
          process.cwd(),
          ".vendor/doordash/dd-cli-v0.2.6-linux-amd64/dd-cli-v0.2.6-linux-amd64",
        )
      : process.env.DOORDASH_CLI_PATH;
  if (!bin) throw Error("unavailable");
  // No shell, dynamic commands, saved addresses, account history, carts or checkout.
  // This isolated process receives only its one credential, not other app secrets.
  const { stdout } = await execute(
    bin,
    [
      "--json-output",
      "search",
      "--query",
      query,
      "--lat",
      String(latitude),
      "--lng",
      String(longitude),
      "--limit",
      "8",
      "--intent",
      'Summary: Help a Duck.Sale visitor discover restaurants and continue on DoorDash.\nuser prompt/purpose: "Find food options; do not order."',
    ],
    {
      encoding: "utf8",
      timeout: 55000,
      maxBuffer: 1_000_000,
      signal,
      env: {
        NODE_ENV: "production",
        PATH: "/usr/bin:/bin",
        HOME: "/tmp",
        TMPDIR: "/tmp",
        LANG: "en_US.UTF-8",
        DD_CLI_ACCESS_TOKEN: process.env.DD_CLI_ACCESS_TOKEN!,
        PYTHON_KEYRING_BACKEND: "keyring.backends.null.Keyring",
      },
    },
  );
  const data = JSON.parse(stdout);
  if (data.success !== true || !Array.isArray(data.stores))
    throw Error("provider");
  // Never forward the response envelope: it may contain saved-address/account data.
  const seen = new Set<string>();
  const stores = data.stores.slice(0, 20).flatMap((raw: unknown) => {
    const parsed = storeSchema.safeParse(raw);
    if (!parsed.success) return [];
    const s = parsed.data;
    if (seen.has(s.store_id)) return [];
    seen.add(s.store_id);
    let image: string | null = null;
    try {
      const u = new URL(s.image_url || "");
      if (
        u.protocol === "https:" &&
        u.hostname === "img.cdn4dd.com" &&
        !u.username &&
        !u.password
      ) {
        u.search = "";
        u.hash = "";
        image = u.toString();
      }
    } catch {}
    return [
      {
        id: s.store_id,
        name: s.name,
        image,
        distance: s.distance || null,
        rating: s.rating ?? null,
        reviewCount: s.review_count ?? null,
        pickup: s.offers_pickup ?? null,
        url: `https://www.doordash.com/store/${s.store_id}`,
      },
    ];
  });
  if (data.stores.length && !stores.length) throw Error("schema");
  return stores;
}
