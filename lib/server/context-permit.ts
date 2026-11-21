import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";
function sign(payload: string) {
  const secret = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!secret) throw new Error("Permit signing is not configured.");
  return createHmac("sha256", secret)
    .update("boatduck-context-permit-v1:" + payload)
    .digest("base64url");
}
export function issueContextPermit(runId: string, workerId: string) {
  const payload = Buffer.from(
    JSON.stringify({ runId, workerId, expires: Date.now() + 300000 }),
  ).toString("base64url");
  return payload + "." + sign(payload);
}
export function verifyContextPermit(token: string) {
  try {
    if (token.length > 1000) return null;
    const [payload, signature, extra] = token.split(".");
    if (!payload || !signature || extra) return null;
    const expected = Buffer.from(sign(payload));
    const supplied = Buffer.from(signature);
    if (
      supplied.length !== expected.length ||
      !timingSafeEqual(supplied, expected)
    )
      return null;
    const data = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
    if (
      !/^[0-9a-f-]{36}$/i.test(data.runId) ||
      !/^(?:[1-9]|10)$/.test(data.workerId) ||
      !Number.isFinite(data.expires) ||
      data.expires <= Date.now()
    )
      return null;
    return data as { runId: string; workerId: string; expires: number };
  } catch {
    return null;
  }
}
