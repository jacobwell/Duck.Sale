// One hosted token, no provider keys. Node 22+; standard library only.
import { readFile } from "node:fs/promises";
const args = process.argv.slice(2);
if (!args.length || args.includes("--help")) {
  console.log(
    'Usage: npm run search:hosted -- "Catalina 30 sailboat for sale California"\nPrivate: npm run search:hosted -- --private request.json\nCheck access without paid work: npm run search:hosted -- --check\nSet DUCK_SALE_BACKEND_URL and DUCK_SALE_HOSTED_TOKEN in .env.hosted.local.',
  );
  process.exit(0);
}
const base = new URL(process.env.DUCK_SALE_BACKEND_URL || "https://duck.sale");
if (
  base.protocol !== "https:" &&
  !(
    base.protocol === "http:" &&
    ["localhost", "127.0.0.1"].includes(base.hostname)
  )
)
  throw new Error("Use HTTPS for hosted access.");
if (
  base.username ||
  base.password ||
  base.pathname !== "/" ||
  base.search ||
  base.hash
)
  throw new Error("Backend URL must be an origin, e.g. https://duck.sale.");
const token = process.env.DUCK_SALE_HOSTED_TOKEN;
if (!token)
  throw new Error(
    "Missing DUCK_SALE_HOSTED_TOKEN. Ask the maintainer for a demo token; provider keys are not needed.",
  );
const check = args[0] === "--check",
  privateMode = args[0] === "--private";
let body;
if (!check) {
  body = privateMode
    ? JSON.parse(await readFile(args[1], "utf8"))
    : {
        query: args.join(" "),
        location: "Anywhere",
        intent: "buy",
        budget: null,
      };
  if (privateMode && body.approved !== true)
    throw new Error(
      'Private JSON must explicitly include "approved": true for its publicQuery.',
    );
}
const path = check
  ? "/api/demo/access"
  : privateMode
    ? "/api/demo/private-search"
    : "/api/demo/search";
try {
  const response = await fetch(new URL(path, base), {
    method: check ? "GET" : "POST",
    redirect: "error",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(300000),
  });
  if (!response.ok) {
    console.error(
      `Hosted request failed (${response.status}): ${await response.text()}`,
    );
    process.exitCode = 1;
  } else if (response.body) {
    // Streams actual NDJSON events; private requests return JSON. Nothing is saved by this script.
    for await (const chunk of response.body) process.stdout.write(chunk);
    process.stdout.write("\n");
  }
} catch {
  console.error(
    "Could not reach the backend, request timed out, or the backend tried to redirect. Check the configured origin and service status.",
  );
  process.exitCode = 1;
}
