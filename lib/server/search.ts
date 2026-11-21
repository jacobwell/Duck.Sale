import { doorDashScout } from "./doordash-scout";
import { foodReady } from "./doordash";
import { aiService } from "./models";
import "server-only";
import { adminDb, saveRun } from "./db";
import { planSearch, planContinuation, extractListings } from "./ai";
import { discover } from "./boat";
import { locateListings } from "./geocode";
import type {
  SearchInput,
  SearchRun,
  SearchEvent,
  WorkerState,
  Listing,
  ApiCall,
} from "@/lib/types";
export async function executeSearch(
  id: string,
  userId: string,
  input: SearchInput,
  emit: (e: SearchEvent) => void,
  signal: AbortSignal,
  continuation?: {
    queries: string[];
    urls: string[];
    note?: string | null;
    priorListings?: Listing[];
  },
  lineage?: {
    parent_run_id: string;
    root_run_id: string;
    voyage_number: number;
  },
  pilotWorkers?: Array<{ name: string; query: string }>,
) {
  const run: SearchRun = {
    id,
    ...input,
    status: "running",
    listings: continuation?.priorListings || [],
    workers: [],
    created_at: new Date().toISOString(),
    ...lineage,
  };
  // Serialize writes so a slower earlier event cannot overwrite newer worker/results state.
  let writes = Promise.resolve();
  function persist() {
    const snapshot = JSON.parse(
      JSON.stringify({ workers: run.workers, listings: run.listings }),
    );
    // Each snapshot is complete, so one failed write must not reject every later
    // one: the next snapshot (or the final save below) catches storage up.
    writes = writes.then(() => saveRun(id, snapshot)).catch(() => {});
    return writes;
  }
  async function update(worker: WorkerState) {
    const previous = run.workers.find((w) => w.id === worker.id);
    const merged = { ...previous, ...worker };
    run.workers = run.workers.map((w) => (w.id === worker.id ? merged : w));
    await persist();
    emit({ type: "worker", worker: merged });
  }
  try {
    if (
      pilotWorkers &&
      (pilotWorkers.length !== 10 ||
        pilotWorkers.some(
          (w) =>
            !w.name || w.name.length > 60 || !w.query || w.query.length > 400,
        ))
    )
      throw new Error("The internal fleet pilot requires ten valid seekers.");
    // Server-only CLI pilot. Public requests cannot choose an arbitrary fleet size.
    const plan = pilotWorkers
      ? { workers: pilotWorkers, doorDash: null }
      : continuation
        ? await planContinuation(id, userId, input, continuation, signal)
        : await planSearch(id, userId, input, signal);
    run.workers = plan.workers.map((w, i) => ({
      ...w,
      id: String(i + 1),
      status: "queued",
    }));
    if (plan.doorDash && input.intent !== "rent" && foodReady())
      run.workers.push({
        id: "4",
        name: `DoorDash ${plan.doorDash.kind} scout`,
        query: plan.doorDash.query,
        status: "queued",
        message: plan.doorDash.reason,
      });
    await persist();
    run.workers.forEach((worker) => emit({ type: "worker", worker }));
    const settled = await Promise.allSettled(
      run.workers.map(async (initial) => {
        const record = async (call: ApiCall) => {
          const current = run.workers.find((w) => w.id === initial.id)!;
          await update({
            ...current,
            calls: [
              ...(current.calls || []).filter((c) => c.id !== call.id),
              call,
            ].slice(-45),
          });
        };
        if (initial.id === "4" && plan.doorDash) {
          try {
            await update({
              ...initial,
              status: "searching",
              message:
                "Resolving a city, then joining the shared DoorDash FIFO queue.",
            });
            const result = await doorDashScout(
              id,
              userId,
              input,
              plan.doorDash,
              AbortSignal.any([signal, AbortSignal.timeout(75000)]),
              async (call) => {
                await record(call);
                await update({
                  ...run.workers.find((w) => w.id === "4")!,
                  message: call.operation,
                });
              },
            );
            const added = result.listings.filter(
              (l) =>
                !run.listings.some(
                  (old) =>
                    normalizeSourceUrl(old.sourceUrl) ===
                    normalizeSourceUrl(l.sourceUrl),
                ) &&
                !continuation?.urls.some(
                  (url) =>
                    normalizeSourceUrl(url) === normalizeSourceUrl(l.sourceUrl),
                ),
            );
            run.listings.push(...added);
            await update({
              ...run.workers.find((w) => w.id === "4")!,
              status: "complete",
              count: added.length,
              partial: result.partial,
              message: result.message,
            });
            if (added.length) emit({ type: "results", listings: added });
          } catch (error) {
            const safe =
              error instanceof Error &&
              /^(Food search (hourly|is busy)|DoorDash (queue|admission|city))/.test(
                error.message,
              )
                ? error.message
                : "DoorDash search could not finish within its queue/provider time budget. Other boats continue.";
            await update({
              ...run.workers.find((w) => w.id === "4")!,
              status: "failed",
              message: safe,
            });
          }
          return;
        }
        let extractionCall: ApiCall | undefined;
        try {
          const evidence = await discover(id, initial, update, signal);
          if (continuation?.urls.length) {
            const inspected = new Set(
              continuation.urls.map(normalizeSourceUrl),
            );
            evidence.pages = evidence.pages.filter(
              (page) => !inspected.has(normalizeSourceUrl(page.url)),
            );
          }
          const savedEvidence = await adminDb().from("source_evidence").insert({
            run_id: id,
            user_id: userId,
            worker_id: initial.id,
            evidence,
          });
          if (savedEvidence.error)
            throw new Error("Could not save source evidence.");
          await update({
            ...run.workers.find((w) => w.id === initial.id)!,
            status: "extracting",
          });
          extractionCall = {
            id: crypto.randomUUID(),
            service: aiService(),
            operation: "extract listings",
            startedAt: new Date().toISOString(),
            status: "running",
          };
          await record(extractionCall);
          const extracted = await extractListings(
            id,
            userId,
            input,
            evidence,
            signal,
          );
          await record({
            ...extractionCall,
            status: "complete",
            finishedAt: new Date().toISOString(),
          });
          extractionCall = undefined;
          const located = await locateListings(
            extracted.map((listing) => ({ ...listing, workerId: initial.id })),
            id,
            userId,
            signal,
            record,
          );
          const added: Listing[] = [];
          for (const listing of located) {
            const normalized = (s: string) => {
              const u = new URL(s);
              for (const k of [...u.searchParams.keys()])
                if (k.startsWith("utm_") || k === "fbclid")
                  u.searchParams.delete(k);
              u.hash = "";
              return u.toString().replace(/\/$/, "");
            };
            if (
              !continuation?.urls.some(
                (url) =>
                  normalizeSourceUrl(url) === normalized(listing.sourceUrl),
              ) &&
              !run.listings.some(
                (l) =>
                  normalized(l.sourceUrl) === normalized(listing.sourceUrl),
              )
            ) {
              run.listings.push(listing);
              added.push(listing);
            }
          }
          await update({
            ...run.workers.find((w) => w.id === initial.id)!,
            status: "complete",
            count: extracted.length,
            partial: evidence.partial || evidence.pages.some((p) => !!p.error),
            message: evidence.partial
              ? "Source search returned partial results."
              : evidence.pages.some((p) => p.error)
                ? "Some pages could only be read partially."
                : `${evidence.pages.length} sources inspected`,
          });
          if (added.length) emit({ type: "results", listings: added });
        } catch (error) {
          if (extractionCall)
            await record({
              ...extractionCall,
              status: "failed",
              finishedAt: new Date().toISOString(),
            });
          console.error("Duck.Sale worker failed", {
            worker: initial.id,
            category: error instanceof Error ? error.name : "UnknownError",
          });
          await update({
            ...run.workers.find((w) => w.id === initial.id)!,
            status: "failed",
            message:
              error instanceof Error &&
              /^Boat sandbox (?:create|startup|command) failed/.test(
                error.message,
              )
                ? error.message + ". No Context calls were made."
                : error instanceof Error &&
                    /^Context (search|scrape) returned HTTP \d+$/.test(
                      error.message,
                    )
                  ? error.message +
                    ". The provider could not complete this request."
                  : error instanceof Error &&
                      /^Context (queue exceeded|request time budget)/.test(
                        error.message,
                      )
                    ? "The shared Context queue reached this worker’s time limit. Try a narrower search or retry shortly."
                    : error instanceof Error &&
                        error.message === "Context request queue unavailable"
                      ? "The shared Context queue is temporarily unavailable. Retry shortly."
                      : "Worker failed. Check Boat, Context, and AI provider access or retry this search.",
          });
        }
      }),
    );
    await writes;
    const failed = run.workers.filter((w) => w.status === "failed").length;
    const incomplete = run.workers.filter((w) => w.partial).length;
    run.status =
      failed === run.workers.length
        ? "failed"
        : failed || incomplete || settled.some((s) => s.status === "rejected")
          ? "partial"
          : "complete";
    if (failed)
      run.warning = `${failed} of ${run.workers.length} workers failed. Any results shown are from the workers that succeeded.`;
    else if (incomplete)
      run.warning =
        "Some sources could only be read partially or reached the provider cooldown/time limit. Available findings were preserved.";
    if (!run.listings.length && run.status === "complete")
      run.warning =
        "No specific listings could be verified from the returned pages. Try a broader location or a more specific item.";
    await saveRun(id, {
      status: run.status,
      listings: run.listings,
      workers: run.workers,
      warning: run.warning || null,
    });
    emit({ type: "complete", run });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Search could not complete.";
    await adminDb()
      .from("search_runs")
      .update({
        status: run.listings.length ? "partial" : "failed",
        listings: run.listings,
        workers: run.workers,
        warning: message,
      })
      .eq("id", id);
    emit({ type: "error", message });
  }
}
function normalizeSourceUrl(value: string) {
  try {
    const url = new URL(value);
    url.hash = "";
    for (const key of [...url.searchParams.keys()])
      if (key.startsWith("utm_") || key === "fbclid")
        url.searchParams.delete(key);
    return url.toString().replace(/\/$/, "");
  } catch {
    return value;
  }
}
