import { z } from "zod";
import { adminDb, userFor } from "@/lib/server/db";
import { discoverFood, foodReady } from "@/lib/server/doordash";
export const runtime = "nodejs";
export const maxDuration = 70;
const headers = { "Cache-Control": "no-store, private" };
export async function GET() {
  return Response.json({ available: foodReady() }, { headers });
}
const input = z
  .object({
    query: z.string().trim().min(2).max(160),
    latitude: z.number().finite().min(-90).max(90),
    longitude: z.number().finite().min(-180).max(180),
  })
  .strict();
export async function POST(request: Request) {
  const user = await userFor(request);
  if (!user)
    return Response.json(
      { error: "Sign in on the main page first." },
      { status: 401, headers },
    );
  if (!foodReady())
    return Response.json(
      {
        error:
          "The food scout is temporarily offline. You can still search directly on DoorDash.",
      },
      { status: 503, headers },
    );
  let data;
  try {
    const body = await request.text();
    if (body.length > 1200) throw Error();
    data = input.parse(JSON.parse(body));
  } catch {
    return Response.json(
      { error: "Choose a city and enter a food or restaurant name." },
      { status: 400, headers },
    );
  }
  const db = adminDb();
  const { data: id, error } = await db.rpc("admit_food_search", {
    owner: user.id,
  });
  if (error)
    return Response.json(
      {
        error: /hourly|busy/.test(error.message)
          ? error.message
          : "Food search is temporarily unavailable.",
      },
      { status: /hourly|busy/.test(error.message) ? 429 : 503, headers },
    );
  try {
    const stores = await discoverFood(
      data.query,
      data.latitude,
      data.longitude,
      AbortSignal.any([request.signal, AbortSignal.timeout(58000)]),
    );
    return Response.json(
      { stores, source: "DoorDash", retrievedAt: new Date().toISOString() },
      { headers },
    );
  } catch {
    // Never send/log CLI stderr, raw response, credentials or account details.
    return Response.json(
      {
        error:
          "DoorDash could not complete this search. Please try again or continue on DoorDash.",
      },
      { status: 502, headers },
    );
  } finally {
    await db
      .from("food_requests")
      .update({ finished_at: new Date().toISOString() })
      .eq("id", id);
  }
}
