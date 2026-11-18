import { adminDb, userFor } from "@/lib/server/db";
import { signIllustrations } from "@/lib/server/illustrations";
export async function GET(request: Request) {
  const user = await userFor(request);
  if (!user)
    return Response.json(
      { error: "Sign in to load your shortlist." },
      { status: 401 },
    );
  const { data, error } = await adminDb()
    .from("saved_listings")
    .select("listing")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });
  if (error)
    return Response.json(
      { error: "Could not load shortlist." },
      { status: 500 },
    );
  return Response.json(
    {
      listings: await signIllustrations(
        (data || []).map((x) => x.listing),
        user.id,
      ),
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
