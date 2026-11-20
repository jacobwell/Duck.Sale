import { z } from "zod";
import { pcSlots, type PcBuild, type PcSource } from "./pc-types";

// Inference extracts facts; it does not decide whether two parts fit.
export const specKeys = [
  "socket",
  "memoryType",
  "memoryCapacityGb",
  "maxMemoryGb",
  "memoryModules",
  "memorySlots",
  "formFactor",
  "supportedFormFactor",
  "lengthMm",
  "maxGpuLengthMm",
  "heightMm",
  "maxCoolerHeightMm",
  "maxPsuLengthMm",
  "psuFormFactor",
  "supportedPsuFormFactor",
  "recommendedPsuW",
  "wattageW",
  "maxPowerW",
  "pcie8PinCount",
  "gpu8PinCount",
  "native16PinCount",
  "gpu16PinCount",
  "eps8PinCount",
  "requiredEps8PinCount",
  "storageInterface",
  "supportedStorageInterface",
  "storageFormFactor",
  "supportedStorageFormFactor",
] as const;
export const pcFactsSchema = z.object({
  facts: z
    .array(
      z.object({
        slot: z.enum(pcSlots),
        key: z.enum(specKeys),
        value: z.string().min(1).max(70),
        sourceId: z.string().max(50),
        quote: z.string().min(8).max(500),
        identityQuote: z.string().min(3).max(400),
        variantQuotes: z.array(z.string().min(3).max(250)).max(3).optional(),
      }),
    )
    .max(90),
});
export type PcFact = z.infer<typeof pcFactsSchema>["facts"][number];

const brands: Record<string, string[]> = {
  amd: ["amd.com"],
  intel: ["intel.com"],
  asus: ["asus.com"],
  msi: ["msi.com"],
  gigabyte: ["gigabyte.com"],
  asrock: ["asrock.com"],
  corsair: ["corsair.com"],
  crucial: ["crucial.com"],
  kingston: ["kingston.com"],
  gskill: ["gskill.com"],
  samsung: ["samsung.com"],
  western: ["westerndigital.com", "sandisk.com"],
  wd: ["westerndigital.com", "sandisk.com"],
  seasonic: ["seasonic.com"],
  bequiet: ["bequiet.com"],
  cooler: ["coolermaster.com"],
  thermaltake: ["thermaltake.com"],
  thermalright: ["thermalright.com"],
  noctua: ["noctua.at"],
  arctic: ["arctic.de"],
  fractal: ["fractal-design.com"],
  nzxt: ["nzxt.com"],
  lianli: ["lian-li.com"],
  phanteks: ["phanteks.com"],
  deepcool: ["deepcool.com"],
  zotac: ["zotac.com"],
  sapphire: ["sapphiretech.com"],
  powercolor: ["powercolor.com"],
  pny: ["pny.com"],
  nvidia: ["nvidia.com"],
  teamgroup: ["teamgroupinc.com"],
  skhynix: ["ssd.skhynix.com"],
};
const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");
export function manufacturerDomains(model: string) {
  const compact = norm(model);
  return Object.entries(brands).find(([b]) => compact.startsWith(b))?.[1] || [];
}
export function isManufacturer(url: string, model: string) {
  const host = new URL(url).hostname.toLowerCase();
  return manufacturerDomains(model).some(
    (d) => host === d || host.endsWith("." + d),
  );
}
export function validateFacts(facts: PcFact[], build: PcBuild) {
  return facts.filter((f) => {
    const source = build.sources.find(
      (s) => s.id === f.sourceId && s.slot === f.slot,
    );
    const model = build.plan?.parts.find((p) => p.slot === f.slot)?.model;
    if (
      !source ||
      !model ||
      source.kind !== "manufacturer-page" ||
      !isManufacturer(source.url, model) ||
      !source.text.includes(f.quote) ||
      !source.text.includes(f.identityQuote)
    )
      return false;
    // Require model identity, including revision / kit / board suffixes.
    // Manufacturer domain establishes the brand. Ignore category prose, but keep
    // every model/variant/capacity/revision token (Wi-Fi, Super, Ti, CL30, etc.).
    if (f.variantQuotes?.some((q) => !source.text.includes(q))) return false;
    const identityText = [f.identityQuote, ...(f.variantQuotes || [])].join(
      " ",
    );
    const brand = Object.keys(brands).find((b) => norm(model).startsWith(b));
    const identity = norm(identityText);
    if (
      f.slot === "GPU" &&
      ["ti", "super"].some(
        (v) =>
          new RegExp(`\\b${v}\\b`, "i").test(identityText) &&
          !new RegExp(`\\b${v}\\b`, "i").test(model),
      )
    )
      return false;
    const sku = model.match(/\(([A-Z0-9-]{8,})\)/)?.[1];
    const exactSku =
      !!sku &&
      new RegExp(`(?:^|[^a-z0-9])${sku}(?=$|[^a-z0-9])`, "i").test(
        identityText,
      );
    const identityRevisions = f.identityQuote.match(/\bv[2-9]\b/gi) || [];
    if (
      identityRevisions.some((v) => !new RegExp(`\\b${v}\\b`, "i").test(model))
    )
      return false;
    const tokens = model
      .replace(
        /^fractal design|^be quiet|^cooler master|^western digital/gi,
        "",
      )
      .replace(/\b\d+[- ](?:core|thread)\b/gi, "")
      .replace(/\bM\.2[- ]2280\b/gi, "")
      .replace(/\bPCIe\s+\d\.\d(?:\s+x\d)?/gi, "")
      .replace(/\b80\+\s*(gold|bronze|platinum|titanium)\b/gi, "")
      .toLowerCase()
      .replace(/g\.skill/g, "gskill")
      .split(/[^a-z0-9]+/)
      .filter(
        (t) =>
          t &&
          t !== brand &&
          ![
            "processor",
            "unlocked",
            "certified",
            "solid",
            "state",
            "drive",
            "cooler",
            "mid",
            "tower",
            "case",
            "nvme",
            "desktop",
            "motherboard",
            "memory",
            "kit",
            "graphics",
            "card",
            "cpu",
            "gpu",
            "psu",
            "power",
            "supply",
            "modular",
            "fully",
            "atx",
            "am5",
            "am4",
            "gb",
            "tb",
            "w",
            "mm",
          ].includes(t),
      );
    if (
      !exactSku &&
      (tokens.length < 2 ||
        !tokens.every((t) => {
          // 7600 must not establish 7600X; 4070 must not stand in for 4070 Ti.
          if (/\d/.test(t) && t.length >= 3) {
            return new RegExp(`(?:^|[^a-z0-9])${t}(?=$|[^a-z0-9])`, "i").test(
              identityText,
            );
          }
          return identity.includes(t);
        }))
    )
      return false;
    if (/Mm$|Gb$|Count$|Modules$|Slots$|W$/.test(f.key)) {
      const value = Number(f.value);
      if (
        !Number.isFinite(value) ||
        value < 0 ||
        value > 10000 ||
        (value === 0 && !f.key.endsWith("Count"))
      )
        return false;
      // No invented numeric conversions or arithmetic in extraction.
      return [...f.quote.matchAll(/\d+(?:\.\d+)?/g)].some(
        (m) => Number(m[0]) === value,
      );
    }
    return norm(f.quote).includes(norm(f.value));
  });
}

export function evaluateCompatibility(facts: PcFact[], sources: PcSource[]) {
  type Check = NonNullable<PcBuild["review"]>["checks"][number];
  const evidence = (fs: PcFact[]) =>
    Array.from(
      new Map(
        fs.map((f) => [
          f.sourceId + f.quote,
          { sourceId: f.sourceId, quote: f.quote },
        ]),
      ).values(),
    );
  const rows: Check[] = [];
  // Disagreement between official pages is never silently resolved.
  function fact(slot: string, key: (typeof specKeys)[number]) {
    const fs = facts.filter((f) => f.slot === slot && f.key === key);
    return new Set(fs.map((f) => norm(f.value))).size === 1 ? fs[0] : undefined;
  }
  function compare(
    name: string,
    requirements: Array<[string, (typeof specKeys)[number]]>,
    run: (fs: PcFact[]) => { ok: boolean; detail: string },
  ) {
    const found = requirements.map(([s, k]) => fact(s, k));
    const missing = requirements.filter((_, i) => !found[i]);
    if (missing.length) {
      rows.push({
        name,
        status: "verify",
        detail:
          "Missing exact-model manufacturer evidence (or conflicting specifications): " +
          missing
            .map(
              ([s, k]) =>
                `${s}: ${k
                  .replace(/([A-Z])/g, " $1")
                  .replace(/Gb$/, "GB")
                  .replace(/Mm$/, "mm")}`,
            )
            .join(", ") +
          ".",
        evidence: evidence(found.filter((f): f is PcFact => !!f)),
      });
    } else {
      const fs = found as PcFact[];
      const r = run(fs);
      rows.push({
        name,
        status: r.ok ? "supported" : "conflict",
        detail: r.detail,
        evidence: evidence(fs),
      });
    }
  }
  const eq = (
    name: string,
    a: [string, (typeof specKeys)[number]],
    b: [string, (typeof specKeys)[number]],
  ) =>
    compare(name, [a, b], ([x, y]) => ({
      ok: norm(x.value) === norm(y.value),
      detail: `${x.slot}: ${x.value}; ${y.slot}: ${y.value}. Exact specification comparison.`,
    }));
  const fit = (
    name: string,
    a: [string, (typeof specKeys)[number]],
    b: [string, (typeof specKeys)[number]],
    margin = 0,
  ) =>
    compare(name, [a, b], ([x, y]) => ({
      ok: Number(x.value) + margin <= Number(y.value),
      detail: `${x.slot}: ${x.value}; ${y.slot} limit: ${y.value}. ${margin ? `Includes ${margin} mm planning clearance.` : "Within the limit only when the first value does not exceed the second."}`,
    }));
  eq("CPU / motherboard socket", ["CPU", "socket"], ["Motherboard", "socket"]);
  eq(
    "Memory generation",
    ["Memory", "memoryType"],
    ["Motherboard", "memoryType"],
  );
  compare(
    "Memory capacity",
    [
      ["Memory", "memoryCapacityGb"],
      ["Motherboard", "maxMemoryGb"],
      ["CPU", "maxMemoryGb"],
    ],
    ([ram, board, cpu]) => ({
      ok: Number(ram.value) <= Math.min(Number(board.value), Number(cpu.value)),
      detail: `${ram.value} GB kit; motherboard limit ${board.value} GB; CPU limit ${cpu.value} GB. Both limits must accommodate the kit.`,
    }),
  );
  fit(
    "Memory module count",
    ["Memory", "memoryModules"],
    ["Motherboard", "memorySlots"],
  );
  function membership(
    name: string,
    a: [string, (typeof specKeys)[number]],
    b: [string, (typeof specKeys)[number]],
  ) {
    const one = fact(...a),
      many = facts.filter((f) => f.slot === b[0] && f.key === b[1]);
    // A list may be incomplete: absence is uncertainty, not proof of incompatibility.
    const match = one && many.find((f) => norm(f.value) === norm(one.value));
    rows.push({
      name,
      status: match ? "supported" : "verify",
      detail: match
        ? `${one!.value} explicitly supported by ${b[0]}.`
        : `Confirm ${a[0]} ${a[1]} is explicitly supported by ${b[0]}; an incomplete list is not proof of incompatibility.`,
      evidence: evidence([...(one ? [one] : []), ...(match ? [match] : [])]),
    });
  }
  membership(
    "Motherboard / case form factor",
    ["Motherboard", "formFactor"],
    ["Case", "supportedFormFactor"],
  );
  fit(
    "GPU / case clearance",
    ["GPU", "lengthMm"],
    ["Case", "maxGpuLengthMm"],
    10,
  );
  membership("Cooler socket mounting", ["CPU", "socket"], ["Cooler", "socket"]);
  fit(
    "Cooler / case height",
    ["Cooler", "heightMm"],
    ["Case", "maxCoolerHeightMm"],
    3,
  );
  membership(
    "PSU / case form factor",
    ["PSU", "psuFormFactor"],
    ["Case", "supportedPsuFormFactor"],
  );
  fit(
    "PSU / case clearance",
    ["PSU", "lengthMm"],
    ["Case", "maxPsuLengthMm"],
    10,
  );
  compare(
    "PSU power headroom",
    [
      ["GPU", "recommendedPsuW"],
      ["GPU", "maxPowerW"],
      ["CPU", "maxPowerW"],
      ["PSU", "wattageW"],
    ],
    ([r, g, c, p]) => {
      const target = Math.max(
        Number(r.value),
        Math.ceil((Number(g.value) + Number(c.value) + 100) * 1.25),
      );
      return {
        ok: Number(p.value) >= target,
        detail: `${p.value} W supply vs ${target} W planning target: maximum of GPU vendor recommendation and (CPU max + GPU max + 100 W other components) × 1.25. Not an electrical certification.`,
      };
    },
  );
  fit(
    "GPU 8-pin power cables",
    ["GPU", "gpu8PinCount"],
    ["PSU", "pcie8PinCount"],
  );
  fit(
    "GPU native 16-pin power cables",
    ["GPU", "gpu16PinCount"],
    ["PSU", "native16PinCount"],
  );
  fit(
    "CPU power cables",
    ["Motherboard", "requiredEps8PinCount"],
    ["PSU", "eps8PinCount"],
  );
  membership(
    "Storage interface",
    ["Storage", "storageInterface"],
    ["Motherboard", "supportedStorageInterface"],
  );
  membership(
    "Storage module length",
    ["Storage", "storageFormFactor"],
    ["Motherboard", "supportedStorageFormFactor"],
  );
  rows.push({
    name: "BIOS / CPU support",
    status: "verify",
    detail:
      "Before buying: open the exact motherboard revision’s CPU support list, find this CPU and its minimum BIOS, then ask the seller which BIOS ships. A matching socket alone does not establish firmware support.",
    evidence: [],
  });
  rows.push({
    name: "Assembly / configuration",
    status: "verify",
    detail:
      "Confirm cooler thermal capacity for sustained CPU load, RAM QVL and CPU memory limits (rated EXPO/XMP speeds are overclocks), RAM-to-cooler clearance, GPU thickness and power-cable bend space, installed fan/cage clearance, included mounting kit, fan headers and front-panel USB headers. Use only cables supplied or explicitly approved for this exact PSU. Numeric case limits assume the documented configuration.",
    evidence: [],
  });
  const supported = rows.filter((c) => c.status === "supported").length,
    conflicts = rows.filter((c) => c.status === "conflict").length;
  return {
    summary: `${supported}/${rows.length} checks supported by exact-model manufacturer evidence; ${conflicts} conflicts; ${rows.length - supported - conflicts} need verification. This is evidence coverage, not a probability of success.`,
    checks: rows.map((c) => ({
      ...c,
      evidence: c.evidence.filter((e) =>
        sources.some((s) => s.id === e.sourceId),
      ),
    })),
  };
}
