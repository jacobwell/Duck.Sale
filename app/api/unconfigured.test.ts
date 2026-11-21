import { mock, test } from "node:test";
import assert from "node:assert/strict";

mock.module("server-only", { namedExports: {} });
delete process.env.NEXT_PUBLIC_SUPABASE_URL;
delete process.env.SUPABASE_SERVICE_ROLE_KEY;

const routes = {
  "GET /api/saved": async () => (await import("./saved/route")).GET,
  "POST /api/illustrations": async () =>
    (await import("./illustrations/route")).POST,
  "GET /api/food/locations": async () =>
    (await import("./food/locations/route")).GET,
  "GET /api/pc": async () => (await import("./pc/route")).GET,
};

for (const [name, load] of Object.entries(routes))
  test(`${name} answers 503 when Supabase is not configured`, async () => {
    const [method, path] = name.split(" ");
    const handler = await load();
    const response = await handler(
      new Request(`http://localhost${path}`, {
        method,
        headers: { authorization: "Bearer signed-in-elsewhere" },
      }),
    );
    assert.equal(response.status, 503);
  });
