import { demoUserFor } from "@/lib/server/demo-access";
export const runtime = "nodejs";
export async function GET(request: Request) {
  const authorized = !!demoUserFor(request);
  return Response.json(
    { authorized, scope: authorized ? ["search", "private-search"] : [] },
    {
      status: authorized ? 200 : 401,
      headers: { "Cache-Control": "no-store" },
    },
  );
}
