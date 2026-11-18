import { z } from "zod";
import { adminDb, userFor } from "@/lib/server/db";
import { illustrate, signIllustrations } from "@/lib/server/illustrations";
import type { Listing } from "@/lib/types";
export const maxDuration = 120;
export async function POST(request: Request) {
  const user = await userFor(request);
  if (!user)
    return Response.json(
      { error: "Sign in to create an illustration." },
      { status: 401 },
    );
  const input = z
    .object({ runId: z.string().uuid(), listingId: z.string().uuid() })
    .safeParse(await request.json().catch(() => null));
  if (!input.success)
    return Response.json({ error: "Invalid listing." }, { status: 400 });
  const { data } = await adminDb()
    .from("search_runs")
    .select("listings,status")
    .eq("id", input.data.runId)
    .eq("user_id", user.id)
    .single();
  const listing = (data?.listings as Listing[] | undefined)?.find(
    (l) => l.id === input.data.listingId,
  );
  if (data?.status === "running")
    return Response.json(
      {
        error:
          "Wait for the search to finish before generating an illustration.",
      },
      { status: 409 },
    );
  if (!listing)
    return Response.json({ error: "Listing not found." }, { status: 404 });
  if (listing.imageStoragePath)
    return Response.json({
      listing: (await signIllustrations([listing], user.id))[0],
    });
  if (listing.imageUrl)
    return Response.json(
      { error: "This listing already has a source photo." },
      { status: 409 },
    );
  try {
    return Response.json({
      listing: await illustrate(user.id, input.data.runId, listing),
    });
  } catch (error) {
    const message =
      error instanceof Error &&
      /hour|capacity|already generating/.test(error.message)
        ? error.message
        : "Could not generate an illustration. Your original listing is unchanged.";
    return Response.json({ error: message }, { status: 503 });
  }
}
