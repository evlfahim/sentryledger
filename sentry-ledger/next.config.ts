import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  // Mark API routes and dynamic pages as dynamic rendering
  // since they depend on server-side data (SQLite)
  experimental: {
    serverActions: {},
  },
};

export default nextConfig;
