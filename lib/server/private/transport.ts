import { Agent, request } from "node:https";
import { policyFromTrustRelease } from "@lore-hex/trusted-router/attestation";
import { verifyGatewaySession } from "@lore-hex/trusted-router/session";
const baseUrl = "https://api.confidential.nytokenexchange.com";
// Verify before releasing the API key or prompt, then reuse that exact TLS socket.
export async function confidentialRequest(
  body: string,
  apiKey: string,
  signal: AbortSignal,
  progress?: (
    phase: "attesting" | "verified" | "request" | "response",
    status?: number,
  ) => void,
) {
  signal.throwIfAborted();
  progress?.("attesting");
  const policy = await policyFromTrustRelease({
    allowDebug: false,
    fetchImpl: (input, init) =>
      fetch(input, {
        ...init,
        cache: "no-store",
        signal: AbortSignal.any([signal, AbortSignal.timeout(10000)]),
      }),
  });
  signal.throwIfAborted();
  const session = await verifyGatewaySession({
    baseUrl,
    policy,
    timeoutMs: 15000,
  });
  const agent = new Agent({ keepAlive: false });
  let used = false;
  agent.createConnection = () => {
    if (used || session.socket.destroyed)
      throw new Error("Attested connection unavailable");
    used = true;
    return session.socket;
  };
  try {
    signal.throwIfAborted();
    if (
      session.attestation.binding !== "tls-exporter" ||
      !session.attestation.expiresAt ||
      session.attestation.expiresAt * 1000 <= Date.now()
    )
      throw new Error("Attested connection expired");
    progress?.("verified");
    progress?.("request");
    const response = await new Promise<{ status: number; body: string }>(
      (resolve, reject) => {
        const req = request(
          baseUrl + "/v1/chat/completions",
          {
            method: "POST",
            agent,
            signal,
            headers: {
              Authorization: "Bearer " + apiKey,
              "Content-Type": "application/json",
              "Content-Length": Buffer.byteLength(body),
            },
          },
          (res) => {
            const chunks: Buffer[] = [];
            let length = 0;
            res.on("data", (chunk: Buffer) => {
              length += chunk.length;
              if (length > 1_000_000) {
                req.destroy(new Error("Response too large"));
                return;
              }
              chunks.push(chunk);
            });
            res.on("error", reject);
            res.on("end", () =>
              resolve({
                status: res.statusCode || 0,
                body: Buffer.concat(chunks).toString("utf8"),
              }),
            );
          },
        );
        req.on("socket", (socket) => socket.resume());
        req.on("error", reject);
        req.setTimeout(65000, () =>
          req.destroy(new Error("Confidential request timed out")),
        );
        req.end(body);
      },
    );
    progress?.("response", response.status);
    return {
      ...response,
      attestation: {
        binding: session.attestation.binding,
        imageDigest: session.attestation.imageDigest,
        expiresAt: session.attestation.expiresAt,
      },
    };
  } finally {
    agent.destroy();
    session.socket.destroy();
  }
}
