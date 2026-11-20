import pg from "pg";
import { readFile, readdir } from "node:fs/promises";
const connectionString =
  process.env.POSTGRES_URL_NON_POOLING || process.env.POSTGRES_URL;
if (!connectionString)
  throw new Error(
    "POSTGRES_URL_NON_POOLING is missing. Pull the Duck.Sale Vercel environment first.",
  );
const url = new URL(connectionString);
url.searchParams.delete("sslmode");
const ca = await readFile(
  new URL("../supabase/certs/prod-ca-2021.crt", import.meta.url),
  "utf8",
);
const client = new pg.Client({
  connectionString: url.toString(),
  ssl: { ca, rejectUnauthorized: true },
  connectionTimeoutMillis: 15000,
});
try {
  await client.connect();
  await client.query("begin");
  await client.query(
    "create table if not exists public.boatduck_migrations (name text primary key, applied_at timestamptz default now())",
  );
  await client.query(
    "alter table public.boatduck_migrations enable row level security",
  );
  for (const file of (
    await readdir(new URL("../supabase/migrations/", import.meta.url))
  )
    .filter((f) => f.endsWith(".sql"))
    .sort()) {
    const name = file.replace(/\.sql$/, "");
    const exists = await client.query(
      "select 1 from public.boatduck_migrations where name=$1",
      [name],
    );
    if (!exists.rowCount) {
      await client.query(
        await readFile(
          new URL("../supabase/migrations/" + name + ".sql", import.meta.url),
          "utf8",
        ),
      );
      await client.query(
        "insert into public.boatduck_migrations(name) values($1)",
        [name],
      );
      console.log("Applied Duck.Sale schema and RLS policies.");
    } else console.log("Duck.Sale migration already applied.");
  }
  await client.query("commit");
} catch (e) {
  await client.query("rollback").catch(() => {});
  console.error("Migration failed:", e.code || e.name);
  process.exitCode = 1;
} finally {
  await client.end();
}
