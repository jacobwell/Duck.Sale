import { after } from "next/server";
import { userFor, adminDb, saveRun } from "@/lib/server/db";
import { pcInputSchema, type PcBuild } from "@/lib/pc-types";
import { executePcBuild } from "@/lib/server/pc-build";
export const runtime = "nodejs";
export const maxDuration = 300;
const headers = { "Cache-Control": "no-store, private" };
export async function GET(request: Request) {
  const user = await userFor(request);
  if (!user)
    return Response.json(
      { error: "Sign in on the main page first." },
      { status: 401, headers },
    );
  const id = new URL(request.url).searchParams.get("id");
  if (!id || !/^[0-9a-f-]{36}$/i.test(id))
    return Response.json(
      { error: "Invalid build ID" },
      { status: 400, headers },
    );
  const { data, error } = await adminDb()
    .from("pc_builds")
    .select("payload,updated_at")
    .eq("id", id)
    .eq("user_id", user.id)
    .maybeSingle();
  if (
    data &&
    ["planning", "researching", "reviewing"].includes(data.payload.status) &&
    Date.now() - Date.parse(data.updated_at) > 6 * 60 * 1000
  ) {
    data.payload = {
      ...data.payload,
      status: data.payload.plan ? "partial" : "failed",
      message:
        "This build stopped before finishing. Saved research is preserved; start a new build to retry.",
    };
    await adminDb()
      .from("pc_builds")
      .update({ payload: data.payload, updated_at: new Date().toISOString() })
      .eq("id", id)
      .eq("user_id", user.id);
    await saveRun(id, { status: "partial", warning: data.payload.message });
  }
  return error || !data
    ? Response.json({ error: "Build not found" }, { status: 404, headers })
    : Response.json(data.payload, { headers });
}
export async function POST(request: Request) {
  const user = await userFor(request);
  if (!user)
    return Response.json(
      { error: "Sign in on the main page first." },
      { status: 401, headers },
    );
  if (!process.env.TRUSTEDROUTER_API_KEY || !process.env.CONTEXT_DEV_API_KEY)
    return Response.json(
      { error: "PC mode needs NYTE and Context.dev configured." },
      { status: 503, headers },
    );
  let input;
  try {
    const raw = await request.text();
    if (raw.length > 2500) throw Error();
    input = pcInputSchema.parse(JSON.parse(raw));
  } catch {
    return Response.json(
      { error: "Enter a $500–$20,000 budget, a use case and a location." },
      { status: 400, headers },
    );
  }
  const db = adminDb();
  const { data: id, error } = await db.rpc("admit_search", {
    owner: user.id,
    search_query: "PC build: " + input.purpose,
    search_location: input.location,
    search_intent: "buy",
    search_budget: input.budget,
  });
  if (error)
    return Response.json(
      {
        error: /hour|running|capacity/.test(error.message)
          ? error.message
          : "Build admission unavailable.",
      },
      { status: 429, headers },
    );
  const build: PcBuild = {
    id,
    input,
    status: "planning",
    message: "Preparing your build…",
    sources: [],
  };
  const saved = await db
    .from("pc_builds")
    .insert({ id, user_id: user.id, payload: build });
  if (saved.error) {
    await saveRun(id, { status: "failed" });
    return Response.json(
      { error: "PC storage unavailable." },
      { status: 503, headers },
    );
  }
  let closed = false,
    completion = Promise.resolve();
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    start(controller) {
      const emit = (b: PcBuild) => {
        if (!closed)
          try {
            controller.enqueue(encoder.encode(JSON.stringify(b) + "\n"));
          } catch {
            closed = true;
          }
      };
      emit(build);
      const heartbeat = setInterval(() => {
        if (!closed)
          try {
            controller.enqueue(encoder.encode("\n"));
          } catch {
            closed = true;
          }
      }, 15000);
      completion = executePcBuild(
        build,
        user.id,
        emit,
        AbortSignal.timeout(265000),
      )
        .catch(() => {})
        .finally(() => {
          clearInterval(heartbeat);
          if (!closed) {
            closed = true;
            controller.close();
          }
        });
    },
    cancel() {
      closed = true;
    },
  });
  after(() => completion);
  return new Response(stream, {
    headers: {
      ...headers,
      "Content-Type": "application/x-ndjson",
      "X-Accel-Buffering": "no",
    },
  });
}
