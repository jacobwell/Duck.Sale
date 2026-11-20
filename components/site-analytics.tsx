"use client";

import { Analytics, type BeforeSend } from "@vercel/analytics/next";
import { usePathname } from "next/navigation";

const isPrivate = (path: string) =>
  path === "/private" || path.startsWith("/private/");

// This remains installed after client navigation, so check the current page too.
const publicPageViewsOnly: BeforeSend = (event) => {
  if (event.type !== "pageview" || isPrivate(window.location.pathname))
    return null;
  try {
    const url = new URL(event.url);
    if (isPrivate(url.pathname)) return null;
    url.search = "";
    url.hash = "";
    if (url.pathname.startsWith("/search/")) url.pathname = "/search/[id]";
    return { ...event, url: url.toString() };
  } catch {
    return null;
  }
};

export function SiteAnalytics() {
  const pathname = usePathname();
  // Do not load the analytics script on a direct visit to Private Mode.
  if (!pathname || isPrivate(pathname)) return null;
  return <Analytics beforeSend={publicPageViewsOnly} />;
}
