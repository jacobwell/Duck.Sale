import { mock, test } from "node:test";
import assert from "node:assert/strict";
import type { SearchEvent, WorkerState } from "@/lib/types";

const RAW_STORAGE_ERROR = "storage detail that must not be logged";
let saves = 0;
const saved: Record<string, unknown>[] = [];
mock.module("server-only", { namedExports: {} });
mock.module("./db", {
  namedExports: {
    saveRun: async (_id: string, patch: Record<string, unknown>) => {
      // One transient storage error early in the run, then storage recovers.
      if (++saves === 2) throw new Error(RAW_STORAGE_ERROR);
      saved.push(patch);
    },
    adminDb: () => ({
      from: () => ({
        insert: async () => ({ error: null }),
        update: () => ({ eq: async () => ({ error: null }) }),
      }),
    }),
  },
});
mock.module("./ai", {
  namedExports: {
    planSearch: async () => ({
      doorDash: null,
      workers: ["a", "b", "c"].map((q) => ({ name: q, query: q })),
    }),
    planContinuation: async () => ({ doorDash: null, workers: [] }),
    extractListings: async () => [],
  },
});
mock.module("./boat", {
  namedExports: {
    discover: async (
      _run: string,
      worker: WorkerState,
      update: (w: WorkerState) => Promise<void>,
    ) => {
      await update({ ...worker, status: "searching" });
      return { pages: [], partial: false };
    },
  },
});
mock.module("./geocode", { namedExports: { locateListings: async () => [] } });
mock.module("./doordash", { namedExports: { foodReady: () => false } });
mock.module("./doordash-scout", { namedExports: { doorDashScout: null } });
mock.module("./models", { namedExports: { aiService: () => "OpenAI" } });

test("one failed progress write does not sink the rest of the search", async (t) => {
  const logged = t.mock.method(console, "error", () => {});
  const { executeSearch } = await import("./search");
  const events: SearchEvent[] = [];
  await executeSearch(
    "00000000-0000-4000-8000-000000000000",
    "user",
    {
      query: "inflatable duck",
      location: "Anywhere",
      budget: null,
      intent: "buy",
    },
    (event) => events.push(event),
    new AbortController().signal,
  );
  const last = events.at(-1);
  assert.equal(last?.type, "complete", JSON.stringify(last));
  assert.ok(saves > 3, "later progress writes still reach storage");
  assert.equal(saved.at(-1)?.status, "complete");
  const writeLogs = logged.mock.calls.filter(
    (call) => call.arguments[0] === "Duck.Sale progress write failed",
  );
  assert.equal(writeLogs.length, 1, "the dropped write is logged once");
  assert.ok(!JSON.stringify(writeLogs).includes(RAW_STORAGE_ERROR));
});
