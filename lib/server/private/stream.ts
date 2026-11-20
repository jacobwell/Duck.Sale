import "server-only";
import { after } from "next/server";
import type {
  PrivateActivity,
  PrivateEmit,
  PrivateEvent,
} from "@/lib/private-events";
const headers = {
  "Cache-Control": "no-store, private",
  "Referrer-Policy": "no-referrer",
};
type Outcome = { status: number; body: Record<string, unknown> };
// Streaming is opt-in, so existing hosted clients retain the JSON contract.
export async function privateResponse(
  request: Request,
  execute: (emit: PrivateEmit, signal: AbortSignal) => Promise<Outcome>,
) {
  if (!request.headers.get("accept")?.includes("application/x-ndjson")) {
    const outcome = await execute(() => {}, request.signal);
    return Response.json(outcome.body, { status: outcome.status, headers });
  }
  const cancellation = new AbortController();
  const signal = AbortSignal.any([request.signal, cancellation.signal]);
  const encoder = new TextEncoder();
  let closed = false;
  let completion: Promise<void> = Promise.resolve();
  const stream = new ReadableStream({
    start(controller) {
      const send = (event: PrivateEvent) => {
        if (closed) return;
        try {
          controller.enqueue(encoder.encode(JSON.stringify(event) + "\n"));
        } catch {
          closed = true;
          cancellation.abort();
        }
      };
      send({ type: "heartbeat", at: new Date().toISOString() });
      const pulse = setInterval(
        () => send({ type: "heartbeat", at: new Date().toISOString() }),
        8000,
      );
      completion = (async () => {
        try {
          const outcome = await execute(send, signal);
          send({ type: "result", ...outcome });
        } catch {
          send({
            type: "result",
            status: 502,
            body: {
              error:
                "Private request ended unexpectedly. Cleanup may still be pending; no ordinary inference fallback was used.",
            },
          });
        } finally {
          clearInterval(pulse);
          if (!closed) {
            closed = true;
            controller.close();
          }
        }
      })();
    },
    cancel() {
      closed = true;
      cancellation.abort();
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
export function activity(
  emit: PrivateEmit,
  id: string,
  service: PrivateActivity["service"],
  operation: string,
  status: PrivateActivity["status"],
  extra: Partial<
    Pick<PrivateActivity, "startedAt" | "finishedAt" | "httpStatus" | "count">
  > = {},
) {
  const at = new Date().toISOString();
  emit({
    type: "activity",
    id,
    service,
    operation,
    status,
    at,
    startedAt: extra.startedAt || at,
    ...(status !== "running" ? { finishedAt: at } : {}),
    ...extra,
  });
}
export function inferenceActivity(emit: PrivateEmit, operation: string) {
  const startedAt = new Date().toISOString();
  let inferenceStart = startedAt;
  return (
    phase: "attesting" | "verified" | "request" | "response",
    httpStatus?: number,
  ) => {
    if (phase === "attesting" || phase === "verified")
      activity(
        emit,
        "attestation",
        "NYTE",
        "Verify confidential gateway",
        phase === "verified" ? "complete" : "running",
        { startedAt },
      );
    if (phase === "request") {
      inferenceStart = new Date().toISOString();
      activity(emit, "inference", "NYTE", operation, "running", {
        startedAt: inferenceStart,
      });
    }
    if (phase === "response")
      activity(
        emit,
        "inference",
        "NYTE",
        operation,
        httpStatus === 200 ? "complete" : "failed",
        { startedAt: inferenceStart, httpStatus },
      );
  };
}
