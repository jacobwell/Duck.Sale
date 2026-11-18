import "server-only";
import {
  BoatApi,
  Configuration,
  waitUntilReady,
  streamCommand,
} from "@boatdev/sdk";
import { z } from "zod";
import { workerSource } from "./worker-source";
import { issueContextPermit } from "./context-permit";
import type { WorkerState, ApiCall } from "@/lib/types";
const evidenceSchema = z.object({
  pages: z
    .array(
      z.object({
        url: z.string().url(),
        title: z.string(),
        description: z.string(),
        markdown: z.string(),
        images: z.array(z.object({ url: z.string(), alt: z.string() })),
        retrievedAt: z.string(),
        error: z.string().nullable(),
      }),
    )
    .max(8),
  partial: z.boolean(),
});
export type Evidence = z.infer<typeof evidenceSchema>;
export async function discover(
  runId: string,
  worker: WorkerState,
  update: (w: WorkerState) => Promise<void>,
  signal: AbortSignal,
): Promise<Evidence> {
  const boat = new BoatApi(
    new Configuration({
      basePath: "https://boat.dev/api/v1",
      accessToken: process.env.BOAT_API_KEY!,
      fetchApi: (input, init) =>
        fetch(input, {
          ...init,
          signal: AbortSignal.any([
            ...(init?.signal ? [init.signal] : []),
            AbortSignal.timeout(
              String(input).includes("/command") ? 145000 : 25000,
            ),
          ]),
        }),
    }),
  );
  let sandboxId: string | undefined;
  let evidence: Evidence | undefined;
  try {
    signal.throwIfAborted();
    await update({ ...worker, status: "starting" });
    const created = await boat.create({
      name: `boatduck-${runId.slice(0, 8)}-${worker.id}`,
      type: "small",
      ttlSeconds: 240,
      noEnv: true,
      snapshots: false,
      monitoring: false,
      labels: { app: "boatduck", run: runId },
      env: { CONTEXT_DEV_API_KEY: process.env.CONTEXT_DEV_API_KEY! },
      files: [
        { path: "boatduck-worker.mjs", content: workerSource },
        {
          path: "boatduck-input.json",
          content: JSON.stringify({
            query: worker.query,
            permitUrl: `${process.env.BOATDUCK_APP_URL || "https://boatduck.vercel.app"}/api/context-permit`,
            permitToken: issueContextPermit(runId, worker.id),
          }),
        },
      ],
    });
    sandboxId = created.sandbox.id;
    worker = { ...worker, sandboxId, status: "starting" };
    await update(worker);
    await waitUntilReady(boat, sandboxId, {
      timeoutMs: 60000,
      intervalMs: 1500,
    });
    signal.throwIfAborted();
    await update({ ...worker, status: "searching" });
    let buffer = "",
      stderr = "",
      exited = false;
    worker = { ...worker, status: "searching", calls: worker.calls || [] };
    const callSchema = z.object({
      id: z.string().uuid(),
      service: z.literal("Context.dev"),
      operation: z.enum(["search", "scrape"]),
      status: z.enum(["running", "complete", "failed"]),
      startedAt: z.string(),
      finishedAt: z.string().optional(),
      statusCode: z.number().optional(),
      target: z.string().max(300).optional(),
    });
    async function consume(line: string) {
      const data = JSON.parse(line);
      if (data.type === "api") {
        const call = callSchema.parse(data.call) as ApiCall;
        const previous = worker.calls!.find((c) => c.id === call.id);
        const merged = { ...previous, ...call };
        worker.calls = [
          ...worker.calls!.filter((c) => c.id !== call.id),
          merged,
        ].slice(-40);
        await update({ ...worker });
      } else if (data.type === "evidence")
        evidence = evidenceSchema.parse(data);
      else if (data.type === "throttle" && typeof data.message === "string") {
        worker = { ...worker, message: data.message.slice(0, 200) };
        await update(worker);
      }
    }
    for await (const frame of streamCommand(
      boat,
      sandboxId,
      "node /home/user/boatduck-worker.mjs",
      { timeoutSeconds: 135, signal },
    )) {
      if (frame.type === "stdout") {
        buffer += String(frame.data || "");
        if (buffer.length > 1_000_000)
          throw new Error("Worker output exceeded its limit.");
        let newline;
        while ((newline = buffer.indexOf("\n")) >= 0) {
          const line = buffer.slice(0, newline);
          buffer = buffer.slice(newline + 1);
          if (line.trim()) await consume(line);
        }
      } else if (frame.type === "stderr")
        stderr += String(frame.data || "").slice(0, 1000);
      else if (frame.type === "exit") {
        exited = true;
        if (frame.exitCode !== 0 || frame.timedOut)
          throw new Error(
            stderr.match(
              /Context (?:search|scrape) returned HTTP \d+|Context queue exceeded this worker’s time budget|Context request time budget exhausted|Context request queue unavailable/,
            )?.[0] ||
              "This search worker could not complete its source requests.",
          );
      } else if (frame.type === "error")
        throw new Error("Boat command stream failed.");
    }
    if (buffer.trim()) await consume(buffer);
    if (!exited || !evidence)
      throw new Error("Worker stream ended before returning evidence.");
    return evidence;
  } catch (error) {
    if (evidence?.pages.length) return { ...evidence, partial: true };
    throw error;
  } finally {
    if (sandboxId) {
      try {
        await boat.stop({ sandboxId });
        worker.cleanup = "stopped";
      } catch {
        worker.cleanup = "ttl-fallback";
      }
      // Preserve the phase; caller owns the completion status.
      await update({ ...worker, status: "extracting" });
    }
  }
}
