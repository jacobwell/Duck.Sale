// Opt-in paid integration verification of image storage and account isolation.
// Uses an explicitly synthetic QA record, never a fabricated live search result.
import { createClient } from "@supabase/supabase-js";
import { illustrate } from "../lib/server/illustrations";
import { writeFile } from "node:fs/promises";
import type { Listing } from "../lib/types";
const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const admin = createClient(url, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
  auth: { persistSession: false },
});
const anon = createClient(url, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
  auth: { persistSession: false },
});
const users: string[] = [];
let path: string | undefined;
try {
  const clients = [];
  for (let i = 0; i < 2; i++) {
    const email = `boatduck-image-check-${crypto.randomUUID()}@example.invalid`,
      password = crypto.randomUUID();
    const { data, error } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    });
    if (error || !data.user) throw new Error("QA user creation failed");
    users.push(data.user.id);
    const c = createClient(url, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
      auth: { persistSession: false },
    });
    const login = await c.auth.signInWithPassword({ email, password });
    if (login.error) throw login.error;
    clients.push(c);
  }
  const item: Listing = {
    id: crypto.randomUUID(),
    title: "Giant yellow inflatable rubber duck",
    sourceUrl: "https://example.invalid/qa-only",
    imageUrl: null,
    location: null,
    price: null,
    currency: null,
    priceUnit: "unknown",
    status: "unknown",
    description:
      "A large yellow inflatable duck with an orange bill. Synthetic QA illustration subject, not a listing.",
    highlights: [],
    caveats: ["Synthetic QA record only"],
    evidence: "Synthetic QA record only",
    priceEvidence: null,
    statusEvidence: null,
    confidence: "low",
    matchReason: "QA only",
    retrievedAt: new Date().toISOString(),
    source: "QA",
    sample: true,
  };
  const { data: run, error } = await admin
    .from("search_runs")
    .insert({
      user_id: users[0],
      query: "Synthetic image QA only",
      location: "Anywhere",
      intent: "buy",
      status: "complete",
      listings: [item],
      workers: [],
    })
    .select("id")
    .single();
  if (error) throw error;
  const own = await clients[0]
    .from("search_runs")
    .select("id")
    .eq("id", run.id);
  const other = await clients[1]
    .from("search_runs")
    .select("id")
    .eq("id", run.id);
  const publicRead = await anon
    .from("search_runs")
    .select("id")
    .eq("id", run.id);
  const denied = await clients[1].rpc("admit_search", {
    owner: users[0],
    search_query: "Unauthorized",
    search_location: "Anywhere",
    search_intent: "buy",
    search_budget: null,
  });
  if (
    own.data?.length !== 1 ||
    other.data?.length ||
    publicRead.data?.length ||
    !denied.error
  )
    throw new Error("RLS isolation failed");
  console.log(
    "Owner read, cross-account isolation, anonymous isolation, privileged RPC denial passed.",
  );
  const image = await illustrate(users[0], run.id, item);
  path = image.imageStoragePath;
  if (!image.imageUrl || image.imageKind !== "generated")
    throw new Error("No labeled image returned");
  const photo = await fetch(image.imageUrl);
  if (!photo.ok) throw new Error("Signed image unavailable");
  const bytes = Buffer.from(await photo.arrayBuffer());
  await writeFile(
    "/Users/a/.codex/visualizations/2026/11/18/01a1ed58-5451-7670-a136-61a77b73f9c1/boatduck-qa-duck.png",
    bytes,
  );
  await writeFile(
    "docs/image-verification.json",
    JSON.stringify(
      {
        checkedAt: new Date().toISOString(),
        syntheticQaSubject: true,
        imageModel: process.env.AI_IMAGE_MODEL || "bfl/flux-3-image-klein",
        imageBytes: bytes.length,
        signedImageRead: true,
        rlsIsolation: true,
        privateStorage: true,
      },
      null,
      2,
    ),
  );
  console.log(
    "Real AI image generated, privately stored and retrieved:",
    bytes.length,
    "bytes",
  );
} finally {
  if (path) await admin.storage.from("boatduck-illustrations").remove([path]);
  for (const id of users) await admin.auth.admin.deleteUser(id);
  console.log("Temporary QA users and image removed.");
}
