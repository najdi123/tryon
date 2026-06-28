import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Pin the workspace root so Turbopack doesn't pick a parent dir's lockfile.
  turbopack: {
    root: __dirname,
  },
};

export default nextConfig;
