import { PrivateWorkspace } from "@/components/private-workspace";
export const metadata = {
  title: "Secret Duck — Private Mode",
  robots: { index: false, follow: false },
};
export default function PrivatePage() {
  return <PrivateWorkspace />;
}
