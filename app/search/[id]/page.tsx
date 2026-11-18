import { Workspace } from "@/components/workspace";
export default async function SearchPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <Workspace initialId={id} />;
}
