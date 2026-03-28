import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Keep native / heavy server deps external so Turbopack/webpack analyze less on each server compile.
  serverExternalPackages: [
    // Turbopack can mis-bundle OTEL ESM ("module has no exports"); load from Node at runtime.
    "@opentelemetry/api",
    "@prisma/client",
    "@prisma/adapter-pg",
    "@prisma/adapter-neon",
    "@neondatabase/serverless",
    "pg",
    "openai",
    "ws",
  ],
  experimental: {
    // Large/corrupt turbo caches caused multi-minute compaction + flaky CSS/OTEL; re-enable after stable turbo dev.
    turbopackFileSystemCacheForDev: false,
    optimizePackageImports: ["lucide-react"],
  },
};

export default nextConfig;
