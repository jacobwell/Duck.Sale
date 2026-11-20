import { z } from "zod";
import { adminDb, userFor } from "@/lib/server/db";
import { privateConfig } from "@/lib/server/private/config";
import { privateRank } from "@/lib/server/private/inference";
import { discover } from "@/lib/server/boat";
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
  let vpnExit: string | null = null,
    deleted = false;
  const signal = AbortSignal.any([request.signal, AbortSignal.timeout(255000)]);
  try {
    const evidence = await discover(
      id,
      {
        id: "1",
        name: "Secret Duck",
        query: input.publicQuery,
        status: "queued",
      },
      async () => {},
      signal,
      {
        onVpn: (ip) => {
          vpnExit = ip;
        },
        onCleanup: (ok) => {
          deleted = ok;
        },
      },
    );
    signal.throwIfAborted();
    const ranked = await privateRank(input.brief, evidence, signal);
    return Response.json(
      {
        ...ranked,
        partial: evidence.partial,
        receipt: {
          publicQuery: input.publicQuery,
          vpnExit,
          sandboxDeleted: deleted,
          contentSaved: false,
          admissionMetadataRetained: true,
          thirdPartyDeletionVerified: false,
        },
      },
      { headers },
    );
  } catch {
    return Response.json(
      {
        error:
          "Private voyage could not complete. No ordinary network or AI fallback was used.",
        receipt: {
          vpnExit,
          sandboxDeleted: deleted,
          contentSaved: false,
          admissionMetadataRetained: true,
        },
      },
      { status: 502, headers },
    );
  } finally {
    // Keep account/timing rate-limit evidence, but never write brief, query, output or source content.
    await db
      .from("search_runs")
      .update({ status: "complete", updated_at: new Date().toISOString() })
      .eq("id", id);
  }
}
