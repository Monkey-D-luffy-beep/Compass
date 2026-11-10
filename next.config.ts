import type { NextConfig } from "next";
import path from "node:path";

const nextConfig: NextConfig = {
  // Loaded at run time only (a local database engine, and the Postgres driver), so keep them out of the bundle.
  serverExternalPackages: ["@electric-sql/pglite", "pg"],
  // The starting text for the brain is read from disk the first time.
  outputFileTracingIncludes: { "/**": ["./BRAIN.md"] },
  turbopack: {
    // Pin the project root: a package-lock.json higher up the tree confuses workspace detection.
    root: path.resolve(__dirname),
    rules: {
      "*.css": { loaders: ["@tailwindcss/turbopack"], as: "*.css" },
    },
  },
};

export default nextConfig;
