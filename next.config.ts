import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // The migration SQL files aren't imported by any code path Next.js can
  // trace statically (drizzle's migrator reads them off disk at runtime),
  // so they need to be explicitly included in the serverless bundle for
  // the one-time /api/admin/migrate route to find them in production.
  outputFileTracingIncludes: {
    "/api/admin/migrate": ["./drizzle/**/*"],
  },
};

export default nextConfig;
