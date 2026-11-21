import { Workspace } from "@/components/workspace";
export default async function SearchPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { id } = await params;
  const p = await searchParams;
  return (
    <Workspace
      initialId={id}
      superMode={p.super === "" || p.super === "true"}
    />
  );
}
