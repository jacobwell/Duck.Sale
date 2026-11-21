import { mock, test } from "node:test";
import assert from "node:assert/strict";

const admissions: unknown[] = [];
mock.module("server-only", { namedExports: {} });
mock.module("../../../../lib/server/db", {
  namedExports: {
    userFor: async () => ({ id: "user" }),
    adminDb: () => ({
      rpc: async (...args: unknown[]) => {
        admissions.push(args);
        return { data: null, error: { message: "stop here" } };
      },
    }),
  },
});
// Placeholder values so privateConfig() reports ready; nothing is called.
const key = "A".repeat(43) + "=";
Object.assign(process.env, {
  TRUSTEDROUTER_API_KEY: "test",
  BOAT_API_KEY: "test",
  CONTEXT_DEV_API_KEY: "test",
  SUPABASE_SERVICE_ROLE_KEY: "test",
  DUCK_SALE_PRIVATE_VPN_JSON: JSON.stringify({
    privateKey: key,
    publicKey: key,
    endpointIp: "192.0.2.1",
    endpointPort: 51820,
    address: "10.0.0.2/32",
    dns: "192.0.2.53",
    expectedExitIp: "192.0.2.1",
  }),
});

test("a whitespace-only public query is rejected before admission", async () => {
  const { POST } = await import("./route");
  const response = await POST(
    new Request("http://localhost/api/private/search", {
      method: "POST",
      body: JSON.stringify({
        publicQuery: "      ",
        brief: "a birthday gift for my sister",
        approved: true,
      }),
    }),
  );
  assert.equal(response.status, 400);
  assert.equal(admissions.length, 0);
});
