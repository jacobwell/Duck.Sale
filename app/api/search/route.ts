import { searchInputSchema, type SearchEvent } from "@/lib/types";
import { appConfig } from "@/lib/server/config";
import { adminDb, userFor } from "@/lib/server/db";
import { executeSearch } from "@/lib/server/search";
import { after } from "next/server";
export const runtime = "nodejs";
export const maxDuration = 600;
export async function POST(request: Request) {
  if (!appConfig().ready)
    return Response.json(
      {
        error:
          "Connect the missing services in setup before launching a live search.",
      },
      { status: 503 },
    );
  const user = await userFor(request);
  if (!user)
    return Response.json(
      { error: "Sign in to launch and save a live search." },
      { status: 401 },
    );
  let raw: unknown;
  try {
    const body = await request.text();
    if (body.length > 6000)
      return Response.json(
        { error: "Search request is too large." },
        { status: 413 },
      );
    raw = JSON.parse(body);
  } catch {
    return Response.json({ error: "Invalid search request." }, { status: 400 });
  }
  const parsed = searchInputSchema.safeParse(raw);
  if (!parsed.success)
    return Response.json(
      {
        error:
          "Describe what you need in 5–1,000 characters and use a valid budget.",
      },
      { status: 400 },
    );
  const input = parsed.data;
  const superValue = new URL(request.url).searchParams.get("super");
  const superMode = superValue === "" || superValue === "true";
  if (
    ![3, 5, 10, 25, ...(superMode ? [50, 100] : [])].includes(
      input.boatCount ?? 3,
    )
  )
    return Response.json(
      { error: superMode ? "Choose 3, 5, 10, 25, 50 or 100 boats." : "Choose 3, 5, 10 or 25 boats." },
      { status: 400 },
    );
  const { data: id, error } = await adminDb().rpc("admit_search", {
    owner: user.id,
    search_query: input.query,
    search_location: input.location,
    search_intent: input.intent,
    search_budget: input.budget,
  });
  if (error) {
    const limited = /hour|already running/.test(error.message);
    return Response.json(
      {
        error: limited
          ? error.message
          : "Search storage is not ready. Apply the Supabase migration.",
      },
      { status: limited ? 429 : 503 },
    );
  }
  const encoder = new TextEncoder();
  let closed = false;
  let completion: Promise<void> = Promise.resolve();
  const stream = new ReadableStream({
    start(controller) {
      completion = (async () => {
        const emit = (e: SearchEvent) => {
          if (!closed) {
            try {
              controller.enqueue(encoder.encode(JSON.stringify(e) + "\n"));
            } catch {
              closed = true;
            }
          }
        };
        emit({ type: "run", id });
        // The server owns completion: refresh/disconnect does not discard the saved run.
        const heartbeat = setInterval(() => {
          if (!closed) {
            try {
              controller.enqueue(encoder.encode("\n"));
            } catch {
              closed = true;
            }
          }
        }, 15000);
        try {
          await executeSearch(
            id,
            user.id,
            input,
            emit,
            AbortSignal.timeout((input.boatCount ?? 3) > 3 ? 560000 : 260000),
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
