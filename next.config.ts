import type { NextConfig } from "next";
const config: NextConfig = {
  // Keep production compilation separate from the user's running dev server.
  distDir:
    process.env.DUCK_SALE_BUILD_DIR ||
    process.env.BOATDUCK_BUILD_DIR ||
    ".next",
  serverExternalPackages: ["@boatdev/sdk", "@lore-hex/trusted-router"],
  outputFileTracingIncludes: {
    "/api/search": ["./.vendor/doordash/dd-cli-v0.2.6-linux-amd64/**/*"],
    "/api/search/continue": [
      "./.vendor/doordash/dd-cli-v0.2.6-linux-amd64/**/*",
    ],
    "/api/food/search": ["./.vendor/doordash/dd-cli-v0.2.6-linux-amd64/**/*"],
  },
  images: {
    remotePatterns: [{ protocol: "https", hostname: "images.unsplash.com" }],
  },
  async redirects() {
    return [
      {
        source: "/demo/boatduck-:asset",
        destination: "/demo/duck-sale-:asset",
        permanent: true,
      },
    ];
  },
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "X-Frame-Options", value: "DENY" },
        ],
      },
      {
        source: "/private",
        headers: [
          { key: "Cache-Control", value: "no-store, private" },
          { key: "Referrer-Policy", value: "no-referrer" },
        ],
      },
    ];
  },
};
export default config;
