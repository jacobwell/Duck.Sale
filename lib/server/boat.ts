import "server-only";
import {
  BoatApi,
  Configuration,
  waitUntilReady,
  streamCommand,
} from "@boatdev/sdk";
import { z } from "zod";
import { privateVpn } from "./private/config";
import { vpnSource } from "./private/vpn-source";
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
  privacy?: {
    onVpn: (exitIp: string) => void;
    onCleanup: (deleted: boolean) => void;
  },
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
  const vpn = privacy ? privateVpn() : null;
  if (privacy && !vpn) throw new Error("Private VPN is not configured.");
  let vpnVerified = false;
  let sandboxId: string | undefined;
  let evidence: Evidence | undefined;
  let phase: "create" | "startup" | "command" = "create";
  try {
    signal.throwIfAborted();
    await update({ ...worker, status: "starting" });
    const created = await boat.create({
      name: `duck-sale-${runId.slice(0, 8)}-${worker.id}`,
      type: "small",
      ttlSeconds: 240,
      noEnv: true,
      snapshots: false,
      monitoring: false,
      labels: { app: "duck-sale", run: runId },
      env: { CONTEXT_DEV_API_KEY: process.env.CONTEXT_DEV_API_KEY! },
      files: [
        ...(vpn
          ? [
              { path: "boatduck-vpn.json", content: JSON.stringify(vpn) },
              { path: "boatduck-vpn.mjs", content: vpnSource },
            ]
          : []),
        { path: "boatduck-worker.mjs", content: workerSource },
        {
          path: "boatduck-input.json",
          content: JSON.stringify({
            query: worker.query,
            excludeUrls: worker.excludeUrls || [],
            permitUrl: `${process.env.DUCK_SALE_APP_URL || process.env.BOATDUCK_APP_URL || "https://duck.sale"}/api/context-permit`,
            permitToken: issueContextPermit(runId, worker.id),
          }),
        },
      ],
    });
    sandboxId = created.sandbox.id;
    worker = { ...worker, sandboxId, status: "starting" };
    await update(worker);
    phase = "startup";
    await waitUntilReady(boat, sandboxId, {
      timeoutMs: 60000,
      intervalMs: 1500,
    });
    signal.throwIfAborted();
    await update({ ...worker, status: "searching" });
    phase = "command";
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
      if (
        data.type === "vpn" &&
        privacy &&
        data.verified === true &&
        data.exitIp === vpn?.expectedExitIp
      ) {
        vpnVerified = true;
        privacy.onVpn(data.exitIp);
      } else if (data.type === "api") {
        if (privacy && !vpnVerified)
          throw new Error("VPN verification missing.");
        const call = callSchema.parse(data.call) as ApiCall;
        const previous = worker.calls!.find((c) => c.id === call.id);
        const merged = { ...previous, ...call };
        worker.calls = [
          ...worker.calls!.filter((c) => c.id !== call.id),
          merged,
        ].slice(-40);
        await update({ ...worker });
      } else if (data.type === "evidence") {
        if (privacy && !vpnVerified)
          throw new Error("VPN verification missing.");
        evidence = evidenceSchema.parse(data);
      } else if (data.type === "throttle" && typeof data.message === "string") {
        worker = { ...worker, message: data.message.slice(0, 200) };
        await update(worker);
      }
    }
    for await (const frame of streamCommand(
      boat,
      sandboxId,
      privacy
        ? "node /home/user/boatduck-vpn.mjs"
        : "node /home/user/boatduck-worker.mjs",
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
    if (!exited || !evidence || (privacy && !vpnVerified))
      throw new Error("Worker stream ended before returning evidence.");
    return evidence;
  } catch (error) {
    if (evidence?.pages.length) return { ...evidence, partial: true };
    const status =
      typeof error === "object" &&
      error &&
      "status" in error &&
      typeof error.status === "number"
        ? ` HTTP ${error.status}`
        : "";
    if (
      error instanceof Error &&
      /^(Context (?:search|scrape) returned HTTP \d+|Context queue exceeded|Context request time budget|Context request queue unavailable)/.test(
        error.message,
      )
    )
      throw error;
    console.error("Duck.Sale sandbox phase failed", {
      phase,
      category: error instanceof Error ? error.name : "UnknownError",
      status: status.trim() || null,
      sandboxState:
        error instanceof Error
          ? error.message.match(
              /Sandbox entered terminal state (archived|archiving|error)/,
            )?.[1] || null
          : null,
    });
    const terminalState =
      error instanceof Error
        ? error.message.match(
            /Sandbox entered terminal state (archived|archiving|error)/,
          )?.[1]
        : null;
    throw new Error(
      `Boat sandbox ${phase} failed${status}${terminalState ? ` (state: ${terminalState})` : ""}`,
    );
  } finally {
    if (sandboxId) {
      try {
        if (privacy) {
          let deletion = await boat.deleteSandbox({
            sandboxId,
            xAsciiConfirmDelete: sandboxId,
          });
          const deadline = Date.now() + 12000;
          while (
            deletion.operation.status !== "completed" &&
            Date.now() < deadline
          ) {
            await new Promise((resolve) => setTimeout(resolve, 1000));
            deletion = await boat.getDeletionOperation({
              operationId: deletion.operation.id,
            });
          }
          privacy.onCleanup(deletion.operation.status === "completed");
        } else await boat.stop({ sandboxId });
        worker.cleanup = "stopped";
      } catch {
        privacy?.onCleanup(false);
        worker.cleanup = "ttl-fallback";
      }
      // Preserve the phase; caller owns the completion status.
      await update({ ...worker, status: "extracting" });
    }
  }
}
