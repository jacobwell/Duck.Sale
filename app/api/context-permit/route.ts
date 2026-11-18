import { z } from "zod";
import { adminDb } from "@/lib/server/db";
import { verifyContextPermit } from "@/lib/server/context-permit";
export const runtime = "nodejs";
export const maxDuration = 15;
export async function POST(request: Request) {
  const scope = verifyContextPermit(
    request.headers.get("authorization")?.replace(/^Bearer /i, "") || "",
  );
  if (!scope)
    return Response.json({ error: "Invalid worker permit." }, { status: 401 });
  const raw = await request.text();
  if (raw.length > 2000)
    return Response.json({ error: "Request too large." }, { status: 413 });
  let body;
  try {
    body = JSON.parse(raw);
  } catch {
    return Response.json({ error: "Invalid request." }, { status: 400 });
  }
  const input = z
    .object({
      requestId: z.string().uuid(),
      release: z.boolean().default(false),
      cooldownMs: z.number().int().min(0).max(86400000).default(0),
    })
    .safeParse(body);
  if (!input.success)
    return Response.json({ error: "Invalid request." }, { status: 400 });
  const { data, error } = await adminDb().rpc("context_permit", {
    search_id: scope.runId,
    request_owner: `${scope.runId}:${scope.workerId}:${input.data.requestId}`,
    release_permit: input.data.release,
    cooldown_ms: input.data.cooldownMs,
  });
  if (error)
    return Response.json(
      { error: "Context queue unavailable. Try another search shortly." },
      { status: 503 },
    );
  return Response.json(data, { headers: { "Cache-Control": "no-store" } });
}
