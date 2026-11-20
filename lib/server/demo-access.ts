import "server-only";
import { createHash, timingSafeEqual } from "node:crypto";

// Limited bearer capabilities, deliberately separate from Supabase login tokens.
// These tokens cannot read history, saved items, images, or other users' data.
export function demoUserFor(request: Request): { id: string } | null {
  const path = new URL(request.url).pathname;
  const permitted =
    (request.method === "POST" &&
      ["/api/demo/search", "/api/demo/private-search"].includes(path)) ||
    (request.method === "GET" && path === "/api/demo/access");
  if (!permitted) return null;
  const token = request.headers.get("authorization")?.replace(/^Bearer /i, "");
  if (!token || !/^ds_demo_[A-Za-z0-9_-]{43}$/.test(token)) return null;
  try {
    const access = JSON.parse(process.env.DUCK_SALE_DEMO_ACCESS || "null");
    if (
      !access ||
      !/^[a-f0-9]{64}$/.test(access.sha256) ||
      !/^[a-f0-9-]{36}$/i.test(access.userId) ||
      !Number.isFinite(access.expiresAt) ||
      access.expiresAt <= Date.now()
    )
      return null;
    const actual = createHash("sha256").update(token).digest();
    const expected = Buffer.from(access.sha256, "hex");
    return timingSafeEqual(actual, expected) ? { id: access.userId } : null;
  } catch {
    return null;
  }
}
