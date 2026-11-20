import { z } from "zod";
import { adminDb, userFor } from "@/lib/server/db";
import { privateConfig } from "@/lib/server/private/config";
import { privateRank } from "@/lib/server/private/inference";
import { discover } from "@/lib/server/boat";
import {
  privateResponse,
  activity,
  inferenceActivity,
} from "@/lib/server/private/stream";
export const runtime = "nodejs";
export const maxDuration = 300;
const headers = {
  "Cache-Control": "no-store, private",
  "Referrer-Policy": "no-referrer",
};
export async function GET() {
  return Response.json(privateConfig(), { headers });
}
export async function POST(request: Request) {
  if (!privateConfig().ready)
    return Response.json(
      { error: "Private Mode is docked. Configure NYTE and the VPN first." },
      { status: 503, headers },
    );
  const user = await userFor(request);
  if (!user)
    return Response.json(
      { error: "Sign in on the main page first." },
      { status: 401, headers },
    );
  let input;
  try {
    const raw = await request.text();
    if (raw.length > 9000) throw new Error();
    input = z
      .object({
        publicQuery: z.string().min(5).max(400),
        brief: z.string().min(5).max(6000),
        approved: z.literal(true),
      })
      .parse(JSON.parse(raw));
  } catch {
    return Response.json(
      { error: "Approve a public query and provide a private brief." },
      { status: 400, headers },
    );
  }
  // Admission stores only a constant placeholder plus account/timing metadata.
  const db = adminDb();
  const admission = await db.rpc("admit_private_search", { owner: user.id });
  if (admission.error)
    return Response.json(
      { error: "Private search admission unavailable or rate limited." },
      { status: 429, headers },
    );
  const id = admission.data as string;
  return privateResponse(request, async (emit, requestSignal) => {
    let vpnExit: string | null = null,
      deleted = false;
    let stage: "discovery" | "confidential inference" = "discovery";
    const signal = AbortSignal.any([
      requestSignal,
      AbortSignal.timeout(255000),
    ]);
    const startedAt = new Date().toISOString();
    const seen = new Map<string, string>();
    let workerReady = false;
    let queueActive = false;
    try {
      activity(
        emit,
        "worker",
        "Boat.dev",
        "Launch isolated worker",
        "running",
        { startedAt },
      );
      const evidence = await discover(
        id,
        {
          id: "1",
          name: "Secret Duck",
          query: input.publicQuery,
          status: "queued",
        },
        async (worker) => {
          if (!workerReady && worker.status === "searching") {
            workerReady = true;
            activity(
              emit,
              "worker",
              "Boat.dev",
              "Launch isolated worker",
              "complete",
              { startedAt },
            );
            activity(emit, "vpn", "WireGuard", "Verify VPN exit", "running");
          }
          let newRequest = false;
          for (const call of worker.calls || []) {
            const key = `${call.status}:${call.statusCode || ""}:${call.finishedAt || ""}`;
            if (seen.get(call.id) === key) continue;
            seen.set(call.id, key);
            if (call.status === "running") newRequest = true;
            // Explicit allowlist: never forward worker queries, URLs, page text, or credentials.
            activity(
              emit,
              call.id,
              "Context.dev",
              call.operation === "search"
                ? "Discover public sources"
                : "Read source page",
              call.status,
              {
                startedAt: call.startedAt,
                finishedAt: call.finishedAt,
                httpStatus: call.statusCode,
              },
            );
          }
          if (worker.message && !seen.has(worker.message)) {
            seen.set(worker.message, "seen");
            queueActive = true;
            activity(
              emit,
              "queue",
              "Context.dev",
              "Provider queue / cooldown",
              "running",
            );
          }
          if (newRequest && queueActive) {
            activity(
              emit,
              "queue",
              "Context.dev",
              "Provider queue / cooldown",
              "complete",
            );
            queueActive = false;
          }
        },
        signal,
        {
          onVpn: (ip) => {
            vpnExit = ip;
            activity(emit, "vpn", "WireGuard", "Verify VPN exit", "complete");
            activity(
              emit,
              "sources",
              "Context.dev",
              "Gather public sources",
              "running",
            );
          },
          onCleanupStart: () =>
            activity(
              emit,
              "cleanup",
              "Boat.dev",
              "Delete disposable worker",
              "running",
            ),
          onCleanup: (ok) => {
            deleted = ok;
            activity(
              emit,
              "cleanup",
              "Boat.dev",
              "Delete disposable worker",
              ok ? "complete" : "failed",
            );
          },
        },
      );
      signal.throwIfAborted();
      if (queueActive)
        activity(
          emit,
          "queue",
          "Context.dev",
          "Provider queue / cooldown",
          "complete",
        );
      activity(
        emit,
        "sources",
        "Context.dev",
        evidence.partial
          ? "Sources returned · partial coverage"
          : "Sources returned",
        "complete",
        { count: evidence.pages.filter((p) => p.markdown.length > 0).length },
      );
      stage = "confidential inference";
      const ranked = await privateRank(
        input.brief,
        evidence,
        signal,
        inferenceActivity(emit, "Extract facts and rank privately"),
      );
      activity(
        emit,
        "results",
        "Duck.Sale",
        "Source-supported matches ready",
        "complete",
        { count: ranked.results.length },
      );
      return {
        status: 200,
        body: {
          ...ranked,
          partial: evidence.partial || ranked.partial,
          receipt: {
            publicQuery: input.publicQuery,
            vpnExit,
            sandboxDeleted: deleted,
            contentSaved: false,
            admissionMetadataRetained: true,
            thirdPartyDeletionVerified: false,
          },
        },
      };
    } catch {
      activity(
        emit,
        "failure",
        "Duck.Sale",
        `Stopped during ${stage}`,
        "failed",
      );
      return {
        status: 502,
        body: {
          error: `Private voyage stopped during ${stage}. No ordinary network or AI fallback was used.`,
          receipt: {
            vpnExit,
            sandboxDeleted: deleted,
            contentSaved: false,
            admissionMetadataRetained: true,
          },
        },
      };
    } finally {
      await db
        .from("search_runs")
        .update({ status: "complete", updated_at: new Date().toISOString() })
        .eq("id", id);
    }
  });
}
