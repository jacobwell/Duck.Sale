import { z } from "zod";
export const pcSlots = [
  "CPU",
  "Motherboard",
  "Memory",
  "GPU",
  "Storage",
  "PSU",
  "Case",
  "Cooler",
] as const;
export const pcInputSchema = z
  .object({
    budget: z.number().int().min(500).max(20000),
    purpose: z.string().trim().min(5).max(500),
    location: z.string().trim().min(2).max(120),
  })
  .strict();
export const pcPlanSchema = z
  .object({
    name: z.string().max(100),
    summary: z.string().max(500),
    parts: z
      .array(
        z.object({
          slot: z.enum(pcSlots),
          model: z.string().min(3).max(150),
          allocation: z.number().int().nonnegative().max(20000),
          reason: z.string().max(300),
        }),
      )
      .length(8),
  })
  .refine(
    (p) => new Set(p.parts.map((x) => x.slot)).size === 8,
    "Every slot needs exactly one part",
  );
export const pcChecks = [
  "CPU / motherboard socket",
  "Memory generation",
  "Motherboard / case form factor",
  "GPU / case clearance",
  "Cooler mounting / clearance",
  "PSU wattage / connectors",
  "BIOS support",
  "Storage interface",
] as const;
export const pcReviewSchema = z
  .object({
    summary: z.string().max(700),
    checks: z
      .array(
        z.object({
          name: z.enum(pcChecks),
          status: z.enum(["supported", "conflict", "verify"]),
          detail: z.string().max(600),
          evidence: z
            .array(
              z.object({
                sourceId: z.string().max(40),
                quote: z.string().min(8).max(350),
              }),
            )
            .max(4),
        }),
      )
      .length(8),
  })
  .refine((r) => new Set(r.checks.map((c) => c.name)).size === 8);
export type PcSource = {
  id: string;
  slot: string;
  title: string;
  url: string;
  text: string;
};
export type PcBuild = {
  id: string;
  status: string;
  message: string;
  input: z.infer<typeof pcInputSchema>;
  plan?: z.infer<typeof pcPlanSchema>;
  sources: PcSource[];
  review?: z.infer<typeof pcReviewSchema>;
  error?: string;
  updated_at?: string;
};
