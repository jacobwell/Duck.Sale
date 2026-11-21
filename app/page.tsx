import dynamic from "next/dynamic";
const MegaFleet = dynamic(() =>
  import("@/components/mega-fleet").then((m) => m.MegaFleet),
);
import { Workspace } from "@/components/workspace";
export default async function Home({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const p = await searchParams;
  if (p.mega === "" || p.mega === "true") return <MegaFleet />;
  const q = typeof p.q === "string" ? p.q.slice(0, 1000) : null;
  const budget = typeof p.budget === "string" ? Number(p.budget) : 0;
  return (
    <Workspace
      superMode={p.super === "" || p.super === "true"}
      initialSearch={
        q
          ? {
              query: q,
              location:
                typeof p.location === "string"
                  ? p.location.slice(0, 120)
                  : "United States",
              budget:
                Number.isFinite(budget) && budget > 0
                  ? String(Math.min(budget, 1000000000))
                  : "",
            }
          : undefined
      }
    />
  );
}
