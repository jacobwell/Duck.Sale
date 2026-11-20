import { z } from "zod";
import type { SearchEvent } from "@/lib/types";
import { appConfig } from "@/lib/server/config";
import { adminDb, saveRun, userFor } from "@/lib/server/db";
import { executeSearch } from "@/lib/server/search";
import { after } from "next/server";
export const runtime = "nodejs";
export const maxDuration = 300;
const requestSchema = z.object({
  parentId: z.string().uuid(),
  note: z.string().max(500).optional(),
});
export async function POST(request: Request) {
  if (!appConfig().ready)
    return Response.json(
      { error: "Search services are not ready." },
      { status: 503 },
    );
  const user = await userFor(request);
  if (!user)
    return Response.json(
      { error: "Sign in to continue this search." },
      { status: 401 },
    );
  let raw: unknown;
  try {
    const text = await request.text();
    if (text.length > 1200)
      return Response.json({ error: "Request too large." }, { status: 413 });
    raw = JSON.parse(text);
  } catch {
    return Response.json(
      { error: "Invalid continuation request." },
      { status: 400 },
    );
  }
  const parsed = requestSchema.safeParse(raw);
  if (!parsed.success)
    return Response.json(
      { error: "Choose a valid saved voyage." },
      { status: 400 },
    );
  const db = adminDb();
  const { data: parent, error: parentError } = await db
    .from("search_runs")
    .select(
      "query,location,intent,budget,status,workers,listings,root_run_id,voyage_number",
    )
    .eq("id", parsed.data.parentId)
    .eq("user_id", user.id)
    .single();
  if (parentError || !parent)
    return Response.json(
      { error: "That voyage was not found in your account." },
      { status: 404 },
    );
  const rootId = parent.root_run_id || parsed.data.parentId;
  const { data: voyageRuns, error: voyageError } = await db
    .from("search_runs")
    .select("id,workers")
    .eq("user_id", user.id)
    .or(`id.eq.${rootId},root_run_id.eq.${rootId}`);
  if (voyageError || !voyageRuns?.length)
    return Response.json(
      { error: "Could not load the earlier voyage receipts." },
      { status: 503 },
    );
  const voyageIds = voyageRuns.map((run) => run.id);
  const { data: evidenceRows, error: evidenceError } = await db
    .from("source_evidence")
    .select("evidence")
    .in("run_id", voyageIds)
    .eq("user_id", user.id);
  if (evidenceError)
    return Response.json(
      { error: "Could not load the earlier source receipts." },
      { status: 503 },
    );
  const pages = (evidenceRows || []).flatMap((row) =>
    Array.isArray(row.evidence?.pages) ? row.evidence.pages : [],
  );
  const urls = [
    ...new Set(
      pages
        .map((page) => page.url)
        .filter((url): url is string => typeof url === "string"),
    ),
  ].slice(0, 150);
  const previousQueries = voyageRuns.flatMap((run) =>
    Array.isArray(run.workers)
      ? run.workers
          .map((w: { query?: string }) => w.query)
          .filter((q): q is string => typeof q === "string")
      : [],
  );
  const { data: id, error } = await db.rpc("admit_continuation", {
    owner: user.id,
    parent: parsed.data.parentId,
    note: parsed.data.note || null,
  });
  if (error) {
    const limited = /hour|already running|still running/.test(error.message);
    return Response.json(
      { error: limited ? error.message : "Could not start this continuation." },
      { status: limited ? 429 : 503 },
    );
  }
  const previousListings = Array.isArray(parent.listings)
    ? parent.listings
    : [];
  try {
    await saveRun(id, { listings: previousListings });
  } catch {
    await db
      .from("search_runs")
      .update({ status: "failed", warning: "Could not restore earlier findings." })
      .eq("id", id)
      .eq("user_id", user.id);
    return Response.json(
      { error: "Could not preserve the earlier findings." },
      { status: 503 },
    );
  }
  const input = {
    query: parent.query,
    location: parent.location,
    budget: parent.budget,
    intent: parent.intent,
  };
  const encoder = new TextEncoder();
  let closed = false;
  let completion: Promise<void> = Promise.resolve();
  const stream = new ReadableStream({
    start(controller) {
      completion = (async () => {
        const emit = (event: SearchEvent) => {
          if (!closed)
            try {
              controller.enqueue(encoder.encode(JSON.stringify(event) + "\n"));
            } catch {
              closed = true;
            }
        };
        emit({ type: "run", id });
        const heartbeat = setInterval(() => {
          if (!closed)
            try {
              controller.enqueue(encoder.encode("\n"));
            } catch {
              closed = true;
            }
        }, 15000);
        try {
          await executeSearch(
            id,
            user.id,
            input,
            emit,
            AbortSignal.timeout(260000),
            {
              queries: previousQueries,
              urls,
              note: parsed.data.note,
              priorListings: previousListings,
            },
            {
              parent_run_id: parsed.data.parentId,
              root_run_id: rootId,
              voyage_number: (parent.voyage_number || 1) + 1,
            },
          );
        } finally {
          clearInterval(heartbeat);
          if (!closed) {
            closed = true;
            controller.close();
          }
        }
      })();
    },
    cancel() {
      closed = true;
    },
  });
  after(() => completion);
  return new Response(stream, {
    headers: {
      "Content-Type": "application/x-ndjson",
      "Cache-Control": "no-store",
      "X-Accel-Buffering": "no",
    },
  });
}
