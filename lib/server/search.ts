import "server-only";
import { adminDb, saveRun } from "./db";
import { planSearch, extractListings } from "./ai";
import { discover } from "./boat";
import { locateListing } from "./geocode";
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
) {
  const run: SearchRun = {
    id,
    ...input,
    status: "running",
    listings: [],
    workers: [],
    created_at: new Date().toISOString(),
  };
  // Serialize writes so a slower earlier event cannot overwrite newer worker/results state.
  let writes = Promise.resolve();
  function persist() {
    const snapshot = JSON.parse(
      JSON.stringify({ workers: run.workers, listings: run.listings }),
    );
    writes = writes.then(() => saveRun(id, snapshot));
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
    const plan = await planSearch(id, userId, input, signal);
    run.workers = plan.workers.map((w, i) => ({
      ...w,
      id: String(i + 1),
      status: "queued",
    }));
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
        let extractionCall: ApiCall | undefined;
        try {
          const evidence = await discover(id, initial, update, signal);
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
            service: "AI Gateway",
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
          const added: Listing[] = [];
          for (const extractedListing of extracted) {
            const listing = await locateListing(
              { ...extractedListing, workerId: initial.id },
              signal,
              record,
            );
            const normalized = (s: string) => {
              const u = new URL(s);
              for (const k of [...u.searchParams.keys()])
                if (k.startsWith("utm_") || k === "fbclid")
                  u.searchParams.delete(k);
              u.hash = "";
              return u.toString().replace(/\/$/, "");
            };
            if (
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
          console.error("Boatduck worker failed", {
            worker: initial.id,
            category: error instanceof Error ? error.name : "UnknownError",
          });
          await update({
            ...run.workers.find((w) => w.id === initial.id)!,
            status: "failed",
            message:
              error instanceof Error &&
              /^Context (search|scrape) returned HTTP \d+$/.test(error.message)
                ? error.message +
                  ". The provider could not complete this request."
                : "Worker failed. Check Boat/Context/Gateway access or retry this search.",
          });
        }
      }),
    );
    await writes;
    const failed = run.workers.filter((w) => w.status === "failed").length;
    run.status =
      failed === 3
        ? "failed"
        : failed || settled.some((s) => s.status === "rejected")
          ? "partial"
          : "complete";
    if (failed)
      run.warning = `${failed} of 3 workers failed. Any results shown are from the workers that succeeded.`;
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
