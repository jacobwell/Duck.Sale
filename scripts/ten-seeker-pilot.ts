// Opt-in paid live experiment. Runs locally; never starts or modifies a dev server.
// RUN_TEN_SEEKERS=1 PILOT_OWNER_RUN_ID=<your existing run> node --conditions=react-server --env-file=.env.local --import tsx scripts/ten-seeker-pilot.ts
import { writeFile, mkdir } from "node:fs/promises";
import { adminDb } from "../lib/server/db";
import { executeSearch } from "../lib/server/search";
import type { WorkerState } from "../lib/types";
if (process.env.RUN_TEN_SEEKERS !== "1" || !process.env.PILOT_OWNER_RUN_ID)
  throw new Error(
    "Explicit opt-in and an existing account-owned run are required.",
  );
const count = Number(process.env.PILOT_SEEKERS || "10");
if (![10, 25].includes(count))
  throw new Error("PILOT_SEEKERS must be 10 or 25.");
const db = adminDb();
const { data: parent, error: ownerError } = await db
  .from("search_runs")
  .select("user_id")
  .eq("id", process.env.PILOT_OWNER_RUN_ID)
  .single();
if (ownerError || !parent)
  throw new Error("Could not resolve the pilot owner.");
const input = {
  query:
    "Boats for sale: sailboats, fishing boats and pontoons across US coasts and lakes",
  location: "United States",
  intent: "buy" as const,
  budget: null,
};
const workers = [
  ["Baywatch Duck", "Catalina 30 for sale San Francisco Bay"],
  ["Seattle Quack", "Catalina 36 for sale Seattle Washington"],
  ["San Diego Sailor", "Hunter 33 for sale San Diego California"],
  ["Miami Mallard", "Boston Whaler for sale Miami Florida"],
  ["Tampa Treasure", "Catalina 34 for sale Tampa Florida"],
  ["Chesapeake Quack", "Beneteau sailboat for sale Annapolis Maryland"],
  ["Boston Booty", "Grady White for sale Boston Massachusetts"],
  ["Great Lakes Duck", "Catalina sailboat for sale Chicago Lake Michigan"],
  ["Tahoe Treasure", "Sea Ray for sale Lake Tahoe"],
  ["Ozark Oarsman", "Bennington pontoon for sale Lake Ozarks Missouri"],
  ["Portland Paddle", "Catalina 30 for sale Portland Oregon"],
  ["Puget Pirate", "Ranger Tug for sale Tacoma Washington"],
  ["LA Lagoon", "Beneteau sailboat for sale Los Angeles"],
  ["Santa Barbara Skipper", "Catalina sailboat for sale Santa Barbara"],
  ["Monterey Mallard", "Boston Whaler for sale Monterey California"],
  ["Key West Quack", "Grady White for sale Key West Florida"],
  ["Jacksonville Jib", "Sea Ray for sale Jacksonville Florida"],
  ["Charleston Captain", "Boston Whaler for sale Charleston South Carolina"],
  ["Norfolk Navigator", "Hunter sailboat for sale Norfolk Virginia"],
  ["Newport Nest", "Beneteau sailboat for sale Newport Rhode Island"],
  ["Maine Mallard", "Grady White for sale Portland Maine"],
  ["Erie Explorer", "Catalina sailboat for sale Cleveland Ohio"],
  ["Michigan Mate", "Sea Ray for sale Detroit Michigan"],
  ["Texoma Treasure", "Bennington pontoon for sale Lake Texoma"],
  ["Travis Trawler", "Sea Ray for sale Lake Travis Texas"],
]
  .slice(0, count)
  .map(([name, query]) => ({ name, query }));
const { data: id, error } = await db.rpc("admit_search", {
  owner: parent.user_id,
  search_query: input.query,
  search_location: input.location,
  search_intent: input.intent,
  search_budget: null,
});
if (error) throw new Error(error.message);
const started = Date.now(),
  states = new Map<string, WorkerState>(),
  last = new Map<string, string>();
let peakAllocated = 0,
  peakSearching = 0;
const transitions: unknown[] = [];
console.log("Saved pilot: https://duck.sale/search/" + id);
await executeSearch(
  id,
  parent.user_id,
  input,
  (e) => {
    if (e.type === "worker") {
      states.set(e.worker.id, e.worker);
      peakAllocated = Math.max(
        peakAllocated,
        [...states.values()].filter((w) => w.sandboxId && !w.cleanup).length,
      );
      peakSearching = Math.max(
        peakSearching,
        [...states.values()].filter(
          (w) => w.status === "searching" && !w.cleanup,
        ).length,
      );
      const signature = [
        e.worker.status,
        e.worker.cleanup,
        e.worker.count,
      ].join(":");
      if (last.get(e.worker.id) !== signature) {
        last.set(e.worker.id, signature);
        transitions.push({
          at: new Date().toISOString(),
          workerId: e.worker.id,
          status: e.worker.status,
          sandboxId: e.worker.sandboxId,
          cleanup: e.worker.cleanup,
        });
        console.log(
          e.worker.id,
          e.worker.name,
          e.worker.status,
          e.worker.cleanup || "",
          e.worker.count ?? "",
        );
      }
    }
    if (e.type === "results")
      console.log("New unique listings:", e.listings.length);
    if (e.type === "error") console.log("Run error:", e.message);
  },
  AbortSignal.timeout(360000),
  undefined,
  undefined,
  workers,
);
const { data: run } = await db
  .from("search_runs")
  .select("id,status,listings,workers,warning")
  .eq("id", id)
  .single();
const savedWorkers = (run?.workers || []) as WorkerState[];
const calls = savedWorkers.flatMap((w) => w.calls || []);
const context = calls.filter((c) => c.service === "Context.dev");
const boundaries = context
  .flatMap((c) =>
    c.finishedAt
      ? [
          { time: Date.parse(c.startedAt), delta: 1 },
          { time: Date.parse(c.finishedAt), delta: -1 },
        ]
      : [],
  )
  .sort((a, b) => a.time - b.time || a.delta - b.delta);
let activeContext = 0,
  peakContext = 0;
for (const event of boundaries) {
  activeContext += event.delta;
  peakContext = Math.max(peakContext, activeContext);
}
const summary = {
  runId: id,
  status: run?.status,
  durationSeconds: Math.round((Date.now() - started) / 1000),
  workers: run?.workers?.length,
  sandboxes: new Set(savedWorkers.map((w) => w.sandboxId).filter(Boolean)).size,
  peakAllocated,
  peakSearching,
  peakContext,
  completed: savedWorkers.filter((w) => w.status === "complete").length,
  failed: savedWorkers.filter((w) => w.status === "failed").length,
  stopped: savedWorkers.filter((w) => w.cleanup === "stopped").length,
  listings: run?.listings?.length,
  contextCalls: context.length,
  context429s: context.filter((c) => c.statusCode === 429).length,
  contextFailures: context.filter((c) => c.status === "failed").length,
};
await mkdir(".demo-access", { recursive: true });
await writeFile(
  `.demo-access/${count}-seeker-pilot-${id}.json`,
  JSON.stringify(
    { checkedAt: new Date().toISOString(), summary, run, transitions },
    null,
    2,
  ),
  { mode: 0o600 },
);
console.log(JSON.stringify(summary, null, 2));
