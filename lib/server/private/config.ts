import "server-only";
import { z } from "zod";
const ipv4 = z.string().ipv4();
export const vpnSchema = z.object({
  privateKey: z.string().regex(/^[A-Za-z0-9+/]{43}=$/),
  publicKey: z.string().regex(/^[A-Za-z0-9+/]{43}=$/),
  endpointIp: ipv4,
  endpointPort: z.number().int().min(1).max(65535),
  address: z.string().regex(/^\d{1,3}(?:\.\d{1,3}){3}\/(?:[12]?\d|3[0-2])$/),
  dns: ipv4,
  expectedExitIp: ipv4,
});
export function privateVpn() {
  try {
    return vpnSchema.parse(
      JSON.parse(
        process.env.DUCK_SALE_PRIVATE_VPN_JSON ||
          process.env.BOATDUCK_PRIVATE_VPN_JSON ||
          "{}",
      ),
    );
  } catch {
    return null;
  }
}
export function privateConfig() {
  const services = [
    {
      name: "NYTE confidential route",
      configured: !!process.env.TRUSTEDROUTER_API_KEY,
    },
    { name: "WireGuard VPN configuration", configured: !!privateVpn() },
    { name: "Boat.dev", configured: !!process.env.BOAT_API_KEY },
    { name: "Context.dev", configured: !!process.env.CONTEXT_DEV_API_KEY },
    {
      name: "Supabase admission control",
      configured: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
    },
  ];
  return { ready: services.every((x) => x.configured), services };
}
