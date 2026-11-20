import "server-only";
import { doorDashPermit } from "./doordash-queue";
import type { ApiCall } from "@/lib/types";
import { retailDiscovery } from "./retail-discovery";
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
const itemSchema = z.object({
  item_id: z.string().regex(/^\d+$/),
  item_name: z.string().min(1).max(300),
  store_id: z.string().regex(/^\d+$/),
  store_name: z.string().min(1).max(300),
  price: z.number().finite().nonnegative().optional().nullable(),
  product_url: z.string().optional().nullable(),
  unavailable_reason: z.unknown().optional(),
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
export type DoorDashResult = {
  id: string;
  name: string;
  storeName: string | null;
  price: number | null;
  image: string | null;
  distance: string | null;
  rating: number | null;
  reviewCount: number | null;
  pickup: boolean | null;
  url: string;
  kind: "item" | "restaurant";
};
export async function discoverFood(
  query: string,
  latitude: number,
  longitude: number,
  signal: AbortSignal,
  mode: "restaurants" | "retail" = "restaurants",
  storeId?: string,
  record?: (call: ApiCall) => Promise<void>,
): Promise<{
  stores: DoorDashResult[];
  coverage: { summary: string; receipts: string[] } | null;
}> {
  if (!foodReady()) throw Error("unavailable");
  const bin =
    process.platform === "linux"
      ? path.join(
          process.cwd(),
          ".vendor/doordash/dd-cli-v0.2.6-linux-amd64/dd-cli-v0.2.6-linux-amd64",
        )
      : process.env.DOORDASH_CLI_PATH;
  if (!bin) throw Error("unavailable");
  const run = async (
    command:
      | "search"
      | "find-item-across-retailers"
      | "find-nearby-stores"
      | "find-items",
    args: string[],
  ) => {
    const call: ApiCall = {
      id: crypto.randomUUID(),
      service: "DoorDash",
      operation: command,
      startedAt: new Date().toISOString(),
      status: "running",
    };
    await record?.(call);
    try {
      const { stdout } = await doorDashPermit(
        signal,
        async (position) => {
          await record?.({
            ...call,
            operation: `${command} · FIFO queue #${position}`,
          });
        },
        async () => {
          await record?.(call);
          return execute(
            bin,
            [
              "--json-output",
              command,
              ...args,
              "--intent",
              'Summary: Help a Duck.Sale visitor discover food or retail items; no orders.\nuser prompt/purpose: "Find nearby options; do not order."',
            ],
            {
              encoding: "utf8",
              timeout: 15000,
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
        },
      );
      await record?.({
        ...call,
        status: "complete",
        finishedAt: new Date().toISOString(),
      });
      return JSON.parse(stdout);
    } catch (error) {
      await record?.({
        ...call,
        status: "failed",
        finishedAt: new Date().toISOString(),
      });
      throw error;
    }
  };
  const discovery =
    mode === "retail"
      ? await retailDiscovery(run, query, latitude, longitude, storeId)
      : null;
  const data = discovery
    ? { success: true, results: discovery.results }
    : await run("search", [
        "--query",
        query,
        "--lat",
        String(latitude),
        "--lng",
        String(longitude),
        "--limit",
        "8",
      ]);
  if (mode === "retail") {
    if (data.success !== true || !Array.isArray(data.results))
      throw Error("provider");
    const seen = new Set<string>();
    const items = data.results.slice(0, 80).flatMap((raw: unknown) => {
      const parsed = itemSchema.safeParse(raw);
      if (!parsed.success) return [];
      const p = parsed.data,
        id = `${p.store_id}:${p.item_id}`;
      if (seen.has(id)) return [];
      seen.add(id);
      let url = `https://www.doordash.com/store/${p.store_id}`;
      try {
        const source = new URL(p.product_url || "");
        const parts = source.pathname.split("/");
        if (
          source.protocol === "https:" &&
          ["www.doordash.com", "doordash.com"].includes(source.hostname) &&
          !source.username &&
          !source.password &&
          /^en-(US|CA|AU|NZ)$/.test(parts[1] || "") &&
          parts[2] === "convenience" &&
          parts[3] === "store" &&
          parts[4] === p.store_id &&
          parts[5] === "search" &&
          parts.length === 7 &&
          source.searchParams.get("product_id") === p.item_id
        ) {
          source.search = "";
          source.hash = "";
          source.searchParams.set("product_id", p.item_id);
          url = source.toString();
        }
      } catch {}
      return [
        {
          id,
          name: p.item_name,
          storeName: p.store_name,
          price: p.unavailable_reason ? null : (p.price ?? null),
          image: null,
          distance: null,
          rating: null,
          reviewCount: null,
          pickup: null,
          url,
          kind: "item" as const,
        },
      ];
    });
    if (data.results.length && !items.length) throw Error("schema");
    return {
      stores: items.slice(0, 40),
      coverage: discovery
        ? { summary: discovery.summary, receipts: discovery.receipts }
        : null,
    };
  }
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
        kind: "restaurant" as const,
        storeName: null,
        price: null,
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
  return { stores, coverage: null };
}
