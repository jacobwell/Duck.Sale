import { signIllustrations } from "@/lib/server/illustrations";
import { adminDb, userFor } from "@/lib/server/db";
export const dynamic = "force-dynamic";
export async function GET(request: Request) {
  let user;
  try {
    user = await userFor(request);
  } catch {
    return Response.json(
      { error: "Supabase is not configured." },
      { status: 503 },
    );
  }
  if (!user)
    return Response.json(
      { error: "Sign in to see your searches." },
      { status: 401 },
    );
  const id = new URL(request.url).searchParams.get("id");
  if (id && !/^[0-9a-f-]{36}$/i.test(id))
    return Response.json({ error: "Invalid search ID." }, { status: 400 });
  let query = adminDb().from("search_runs").select("*").eq("user_id", user.id);
  if (id) query = query.eq("id", id);
  const { data, error } = await query
    .order("created_at", { ascending: false })
    .limit(id ? 1 : 20);
  if (error)
    return Response.json(
      { error: "Could not load searches." },
      { status: 500 },
    );
  return Response.json(
    {
      runs: await Promise.all(
        (data || []).map(async (run) => ({
          ...run,
          listings: await signIllustrations(run.listings, user.id),
        })),
      ),
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
