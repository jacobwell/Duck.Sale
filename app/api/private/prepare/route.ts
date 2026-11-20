import { z } from "zod";
import { adminDb, userFor } from "@/lib/server/db";
import { preparePrivateQuery } from "@/lib/server/private/inference";
export const runtime = "nodejs";
export const maxDuration = 120;
const headers = {
  "Cache-Control": "no-store, private",
  "Referrer-Policy": "no-referrer",
};
export async function POST(request: Request) {
  if (
    !process.env.TRUSTEDROUTER_API_KEY ||
    !process.env.SUPABASE_SERVICE_ROLE_KEY ||
    !process.env.NEXT_PUBLIC_SUPABASE_URL
  )
    return Response.json(
      { error: "Configure NYTE and Supabase before preparing a query." },
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
      .object({ brief: z.string().trim().min(5).max(6000) })
      .parse(JSON.parse(raw));
  } catch {
    return Response.json(
      { error: "Provide a private brief of 5–6,000 characters." },
      { status: 400, headers },
    );
  }
  const db = adminDb();
  const { data: id, error } = await db.rpc("admit_private_preparation", {
    owner: user.id,
  });
  if (error)
    return Response.json(
      {
        error:
          "Query preparation is unavailable or rate limited. Try later, or write a public query yourself.",
      },
      { status: 429, headers },
    );
  try {
    const prepared = await preparePrivateQuery(
      input.brief,
      AbortSignal.any([request.signal, AbortSignal.timeout(100000)]),
    );
    return Response.json(prepared, { headers });
  } catch {
    return Response.json(
      {
        error:
          "Confidential preparation could not complete. Nothing was sent to discovery; no ordinary AI fallback was used.",
      },
      { status: 502, headers },
    );
  } finally {
    await db
      .from("private_preparations")
      .update({ finished_at: new Date().toISOString() })
      .eq("id", id);
  }
}
