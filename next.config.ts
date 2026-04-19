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
    // Turbopack FS cache was corrupting under sustained macOS swap pressure
    // (torn writes → "invalid JSON: EOF" panics in get_transpiled_packages).
    // Re-enable once the dev environment is no longer swap-constrained.
    turbopackFileSystemCacheForDev: false,
    optimizePackageImports: [
      "lucide-react",
      "date-fns",
      "@radix-ui/react-dialog",
      "@radix-ui/react-dropdown-menu",
      "@radix-ui/react-hover-card",
      "@radix-ui/react-select",
      "@radix-ui/react-scroll-area",
      "@radix-ui/react-label",
      "@radix-ui/react-switch",
      "@radix-ui/react-separator",
      "@radix-ui/react-progress",
      "@radix-ui/react-slot",
      "@radix-ui/react-tabs",
    ],
  },
};

export default nextConfig;
