import type { Metadata } from "next";
import { Suspense } from "react";
import { SiteAnalytics } from "@/components/site-analytics";
import "./globals.css";
export const metadata: Metadata = {
  title: "Duck.Sale — Find your next whatever.",
  description:
    "A little fleet of search agents. A whole internet of possibilities. Find boats and other hard-to-find things with source-backed results.",
};
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        {children}
        <Suspense fallback={null}>
          <SiteAnalytics />
        </Suspense>
      </body>
    </html>
  );
}
