import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Self-contained server for the Docker image (Railway)
  output: "standalone",
  // Shared TS sources (legal texts) from the monorepo
  transpilePackages: ["@trampo/contracts"],
  eslint: {
    // Admin panel is internal tooling; don't block builds on lint.
    ignoreDuringBuilds: true,
  },
  // Monorepo has multiple lockfiles; pin the trace root to this app.
  outputFileTracingRoot: path.join(__dirname, "../.."),
};

export default nextConfig;
