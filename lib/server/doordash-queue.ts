import "server-only";
import { setTimeout as delay } from "node:timers/promises";
import { adminDb } from "./db";
export async function doorDashPermit<T>(
  signal: AbortSignal,
  waiting: (position: number) => Promise<void>,
  task: () => Promise<T>,
) {
  const requestId = crypto.randomUUID();
  const db = adminDb();
  let cooldown = 0,
    previous = -1;
  try {
    while (true) {
      signal.throwIfAborted();
      const { data, error } = await db.rpc("doordash_permit", {
        request_id: requestId,
      });
      if (error) throw Error("DoorDash queue unavailable");
      if (data?.granted) break;
      if (data?.position !== previous) {
        previous = data?.position;
        await waiting(previous);
      }
      await delay(1000, undefined, { signal });
    }
    signal.throwIfAborted();
    try {
      return await task();
    } catch (error) {
      // Inspect only the machine error code, never log or expose provider stderr.
      const stderr = (error as { stderr?: string }).stderr;
      if (
        typeof stderr === "string" &&
        /"code"\s*:\s*"rate_limited"/.test(stderr)
      )
        cooldown = 30000;
      throw error;
    }
  } finally {
    await db.rpc("doordash_permit", {
      request_id: requestId,
      release_permit: true,
      cooldown_ms: cooldown,
    });
  }
}
