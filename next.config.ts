import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";
import { staticSecurityHeaders } from "./src/lib/security/csp";

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

/*
 * Cache Components is intentionally NOT enabled (see README "Rendering model").
 * Almost every page here renders per-request private data (invitation tokens,
 * admin sessions), so classic dynamic rendering is simpler and avoids any risk
 * of caching private responses.
 */
const nextConfig: NextConfig = {
  // Separate build dir for the e2e server so it can run next to your own `next dev`
  // (Next.js allows one dev server per distDir).
  distDir: process.env.NEXT_DIST_DIR || ".next",
  poweredByHeader: false,
  // Next.js logs Server Action arguments in development by default, which
  // would print passwords (login / change password) to the terminal.
  logging: { serverFunctions: false },
  reactStrictMode: true,
  // Native module: keep out of the server bundle.
  serverExternalPackages: ["@node-rs/argon2"],
  images: {
    remotePatterns: [{ protocol: "https", hostname: "res.cloudinary.com" }],
  },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
  async headers() {
    return [{ source: "/:path*", headers: staticSecurityHeaders(process.env.NODE_ENV === "production") }];
  },
};

export default withNextIntl(nextConfig);
