import "server-only";
import { createClient } from "@supabase/supabase-js";
export function adminDb() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL,
    key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Supabase is not configured.");
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
export async function userFor(request: Request) {
  const token = request.headers.get("authorization")?.replace(/^Bearer /i, "");
  if (!token || token.length > 8192) return null;
  const { data, error } = await adminDb().auth.getUser(token);
  return error ? null : data.user;
}
export async function saveRun(id: string, patch: Record<string, unknown>) {
  const { error } = await adminDb()
    .from("search_runs")
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw new Error("Could not save search progress.");
}
