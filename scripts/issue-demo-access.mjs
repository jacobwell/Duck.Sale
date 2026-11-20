// Maintainer only. Creates a dedicated isolated user and a 24-hour capability.
import { createClient } from "@supabase/supabase-js";
import { randomBytes, createHash } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
const url = process.env.NEXT_PUBLIC_SUPABASE_URL,
  key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) throw new Error("Load the server's .env.local first.");
const directory = `.demo-access/${Date.now()}`;
await mkdir(directory, { recursive: true, mode: 0o700 });
const db = createClient(url, key, {
  auth: { persistSession: false, autoRefreshToken: false },
});
const { data, error } = await db.auth.admin.createUser({
  email: `demo-${randomBytes(12).toString("hex")}@example.invalid`,
  password: randomBytes(32).toString("hex"),
  email_confirm: true,
  app_metadata: { duck_sale_demo: true },
});
if (error || !data.user)
  throw new Error("Could not create the isolated demo account.");
try {
  const token = `ds_demo_${randomBytes(32).toString("base64url")}`;
  const config = {
    sha256: createHash("sha256").update(token).digest("hex"),
    userId: data.user.id,
    expiresAt: Date.now() + 24 * 60 * 60 * 1000,
  };
  await writeFile(`${directory}/server.json`, JSON.stringify(config), {
    mode: 0o600,
    flag: "wx",
  });
  await writeFile(
    `${directory}/client.env`,
    `DUCK_SALE_BACKEND_URL=https://duck.sale\nDUCK_SALE_HOSTED_TOKEN=${token}\n`,
    { mode: 0o600, flag: "wx" },
  );
  console.log(
    `Created ${directory}/server.json and ${directory}/client.env (private files).\nSet DUCK_SALE_DEMO_ACCESS to the server.json contents, then deploy. Share client.env privately with the judge.\nExpires: ${new Date(config.expiresAt).toISOString()}. Remove the server env value and redeploy to revoke; rotation replaces the previous token.`,
  );
} catch (error) {
  await db.auth.admin.deleteUser(data.user.id);
  throw error;
}
