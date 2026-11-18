// Opt-in integration check. Makes one real search and uses provider credits.
// Does not start a server or send email. Removes only its temporary auth user.
import { createClient } from "@supabase/supabase-js";
import { executeSearch } from "../lib/server/search";
import { writeFile } from "node:fs/promises";
const db = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } },
);
const qaQuery =
  process.env.QA_QUERY || "Used Catalina 30 sailboat for sale under $35000";
const qaLocation = process.env.QA_LOCATION || "California";
const qaBudget = process.env.QA_QUERY ? null : 35000;
const password = crypto.randomUUID() + crypto.randomUUID();
const email = `boatduck-check-${crypto.randomUUID()}@example.invalid`;
const { data: created, error: createError } = await db.auth.admin.createUser({
  email,
  password,
  email_confirm: true,
});
if (createError || !created.user)
  throw new Error(
    "Could not create isolated verification user: " + createError?.message,
  );
const userId = created.user.id;
try {
  let id: string;
  if (process.env.QA_TARGET) {
    const client = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { auth: { persistSession: false } },
    );
    const login = await client.auth.signInWithPassword({ email, password });
    if (!login.data.session) throw new Error("QA sign-in failed");
    const response = await fetch(
      new URL("/api/search", process.env.QA_TARGET),
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${login.data.session.access_token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          query: qaQuery,
          location: qaLocation,
          budget: qaBudget,
          intent: "buy",
        }),
        signal: AbortSignal.timeout(290000),
      },
    );
    if (!response.ok)
      throw new Error("Deployed search returned HTTP " + response.status);
    const events = (await response.text())
      .split("\n")
      .filter(Boolean)
      .map((line) => JSON.parse(line));
    id = events.find((e) => e.type === "run")?.id;
    if (!id) throw new Error("No saved run from deployed API");
    console.log("Deployed API events:", events.map((e) => e.type).join(", "));
    const reload = await fetch(
      new URL("/api/searches?id=" + id, process.env.QA_TARGET),
      {
        headers: { Authorization: `Bearer ${login.data.session.access_token}` },
      },
    );
    const reloaded = await reload.json();
    if (!reload.ok || reloaded.runs?.[0]?.id !== id)
      throw new Error("Saved run reload failed");
    console.log("Authenticated saved run reload passed");
  } else {
    const { data: admittedId, error } = await db.rpc("admit_search", {
      owner: userId,
      search_query: qaQuery,
      search_location: qaLocation,
      search_intent: "buy",
      search_budget: qaBudget,
    });
    if (error) throw new Error(error.message);
    id = admittedId;
    console.log("Started live verification run", id);
    await executeSearch(
      id,
      userId,
      {
        query: qaQuery,
        location: qaLocation,
        intent: "buy",
        budget: qaBudget,
      },
      (e) => {
        if (e.type === "worker")
          console.log(
            "Worker",
            e.worker.id,
            e.worker.status,
            e.worker.sandboxId || "",
            e.worker.cleanup || "",
            e.worker.message || "",
          );
        if (e.type === "results")
          console.log("Received listings:", e.listings.length);
        if (e.type === "error") console.log("Pipeline error:", e.message);
      },
      AbortSignal.timeout(260000),
    );
  }
  const { data: run } = await db
    .from("search_runs")
    .select("id,status,listings,workers,warning")
    .eq("id", id)
    .single();
  const { data: generations } = await db
    .from("generations")
    .select("kind,model,status,usage,error")
    .eq("run_id", id);
  const { data: sourceEvidence } = await db
    .from("source_evidence")
    .select("worker_id,evidence")
    .eq("run_id", id);
  await writeFile(
    ".env.qa-evidence.json",
    JSON.stringify(sourceEvidence, null, 2),
    { mode: 0o600 },
  );
  const receipt = { checkedAt: new Date().toISOString(), run, generations };
  await writeFile(
    process.env.QA_RECEIPT ||
      (process.env.QA_TARGET
        ? "docs/deployed-verification.json"
        : "docs/live-verification.json"),
    JSON.stringify(receipt, null, 2),
  );
  console.log(
    "Verification result:",
    JSON.stringify({
      status: run?.status,
      listings: run?.listings.length,
      generations: generations?.map((g) => ({
        kind: g.kind,
        status: g.status,
        error: g.error,
      })),
    }),
  );
  if (!run || run.status === "failed" || !run.listings.length)
    process.exitCode = 1;
} finally {
  await db.auth.admin.deleteUser(userId);
  console.log(
    "Removed temporary verification user and its private records. Sanitized receipt saved.",
  );
}
