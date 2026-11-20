import "server-only";
import { getVercelOidcTokenSync } from "@vercel/oidc";
import type { AppConfig } from "@/lib/types";
export function appConfig(): AppConfig {
  let gatewayConfigured = !!process.env.AI_GATEWAY_API_KEY;
  if (!gatewayConfigured) {
    try {
      gatewayConfigured = !!getVercelOidcTokenSync();
    } catch {
      /* No request-scoped or local credential available. */
    }
  }
  const services = [
    { name: "Boat.dev", configured: !!process.env.BOAT_API_KEY },
    { name: "Context.dev", configured: !!process.env.CONTEXT_DEV_API_KEY },
    {
      name: "AI Gateway",
      configured: gatewayConfigured,
    },
    {
      name: "Supabase",
      configured: !!(
        process.env.NEXT_PUBLIC_SUPABASE_URL &&
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY &&
        process.env.SUPABASE_SERVICE_ROLE_KEY
      ),
    },
  ];
  return {
    ready: services.every((s) => s.configured),
    services,
    vision:
      (process.env.DUCK_SALE_VISION ?? process.env.BOATDUCK_VISION) === "true",
  };
}
