import "server-only";
type Run = (
  command: "find-item-across-retailers" | "find-nearby-stores" | "find-items",
  args: string[],
) => Promise<Record<string, unknown>>;
type Row = Record<string, unknown>;
const words = (s: string) =>
  s
    .toLowerCase()
    .match(/[a-z0-9]+/g)
    ?.filter(
      (w) => !["a", "the", "for", "and", "person", "pack"].includes(w),
    ) || [];
function matches(query: string, name: unknown) {
  if (typeof name !== "string") return false;
  const q = words(query),
    n = new Set(words(name));
  const significant = q.filter((w) => w.length > 2 || /\d/.test(w));
  const models = significant.filter((w) => /\d/.test(w) && w.length > 1);
  if (models.some((w) => !n.has(w))) return false;
  if (/\bboat\b/i.test(query) && !n.has("boat")) return false;
  return (
    significant.length > 0 &&
    significant.filter((w) => n.has(w)).length / significant.length >= 0.6
  );
}
export async function retailDiscovery(
  run: Run,
  query: string,
  lat: number,
  lng: number,
  storeId?: string,
) {
  const receipts: string[] = [];
  const rows: Row[] = [];
  let failures = 0;
  const catalog = async (id: string, name: string) => {
    try {
      const d = await run("find-items", ["--store-id", id, "--query", query]);
      if (d.success !== true || !d.results || typeof d.results !== "object")
        throw Error();
      const raw = (d.results as Record<string, unknown>)[query];
      if (!Array.isArray(raw)) throw Error();
      const found = raw.filter((r: Row) => matches(query, r.item_name));
      receipts.push(`${name} (${id}): ${found.length} title matches`);
      for (const r of found)
        rows.push({
          ...r,
          store_id: id,
          store_name: name,
          price: r.main_price,
        });
    } catch {
      failures++;
      receipts.push(`${name} (${id}): catalog unavailable`);
    }
  };
  if (storeId) {
    await catalog(storeId, `Selected store`);
    if (failures) throw Error("provider");
    return {
      results: rows,
      receipts,
      summary:
        "Searched the exact store you selected. Delivery coverage must be confirmed on DoorDash.",
    };
  }
  const first = await run("find-item-across-retailers", [
    "--query",
    query,
    "--lat",
    String(lat),
    "--lng",
    String(lng),
    "--radius",
    "25",
    "--max",
    "40",
  ]);
  if (first.success !== true || !Array.isArray(first.results))
    throw Error("provider");
  rows.push(...first.results.filter((r: Row) => matches(query, r.item_name)));
  receipts.push(
    `25-mile discovery: ${first.results.length} candidates, ${rows.length} title matches`,
  );
  if (rows.length < 3) {
    // Four bounded discovery areas look for additional branches, not saved addresses.
    // The provider's store discovery radius is fixed at 16 miles; centers are shifted 10 miles.
    const delta = 10 / 69;
    const lonDelta = delta / Math.max(0.2, Math.cos((lat * Math.PI) / 180));
    const centers = [
      [lat + delta, lng],
      [lat - delta, lng],
      [lat, lng + lonDelta],
      [lat, lng - lonDelta],
    ];
    const stores = new Map<string, Row>();
    for (let i = 0; i < centers.length; i += 2) {
      await Promise.all(
        centers.slice(i, i + 2).map(async ([a, b]) => {
          try {
            const d = await run("find-nearby-stores", [
              "--vertical",
              "nv",
              "--max",
              "100",
              "--lat",
              String(Math.max(-90, Math.min(90, a))),
              "--lng",
              String(((b + 540) % 360) - 180),
            ]);
            if (d.success !== true || !Array.isArray(d.stores)) throw Error();
            for (const s of d.stores as Row[])
              if (
                /^\d+$/.test(String(s.store_id)) &&
                typeof s.name === "string"
              )
                stores.set(String(s.store_id), s);
          } catch {
            failures++;
          }
        }),
      );
    }
    receipts.push(
      `Expanded branch discovery: ${stores.size} distinct branches returned`,
    );
    const preferred = /boat|intex|raft|tent|sport|camp/i.test(query)
      ? /big\s*5|sporting|sports|marine|\brei\b/i
      : /gpu|computer|cable|battery|batteries|electronics/i.test(query)
        ? /best buy|target|staples|office|hardware/i
        : /dog|cat|pet/i.test(query)
          ? /pet/i
          : /target|walmart|safeway|grocery|mart/i;
    const ranked = [...stores.values()].sort(
      (a, b) =>
        Number(preferred.test(String(b.name))) -
        Number(preferred.test(String(a.name))),
    );
    const chosen = ranked.slice(0, 6);
    for (let i = 0; i < chosen.length; i += 2)
      await Promise.all(
        chosen
          .slice(i, i + 2)
          .map((s) => catalog(String(s.store_id), String(s.name))),
      );
  }
  if (failures)
    receipts.push(`${failures} provider calls failed; results are partial`);
  return {
    results: rows,
    receipts,
    summary:
      "25-mile item search; sparse results trigger up to six branch catalog searches across four nearby areas. Not exhaustive; confirm delivery on DoorDash.",
  };
}
