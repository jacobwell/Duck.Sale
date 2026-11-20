import { userFor } from "@/lib/server/db";
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
      { error: "Sign in on the main page first." },
      { status: 401 },
    );
  const query = new URL(request.url).searchParams.get("q")?.trim() || "";
  if (query.length < 2 || query.length > 100)
    return Response.json({ error: "Enter a city name." }, { status: 400 });
  try {
    const url = new URL("https://geocoding-api.open-meteo.com/v1/search");
    url.searchParams.set("name", query);
    url.searchParams.set("count", "8");
    url.searchParams.set("language", "en");
    const r = await fetch(url, {
      signal: AbortSignal.timeout(8000),
      cache: "no-store",
    });
    if (!r.ok) throw Error();
    const data = await r.json();
    const places = (data.results || [])
      .filter((p: { country_code?: string }) =>
        ["US", "CA", "AU", "NZ"].includes(p.country_code || ""),
      )
      .map(
        (p: {
          id: number;
          name: string;
          admin1?: string;
          country: string;
          latitude: number;
          longitude: number;
        }) => ({
          id: p.id,
          label: [p.name, p.admin1, p.country].filter(Boolean).join(", "),
          latitude: p.latitude,
          longitude: p.longitude,
        }),
      );
    return Response.json(
      { places },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch {
    return Response.json(
      { error: "City lookup is unavailable. Try again shortly." },
      { status: 502 },
    );
  }
}
