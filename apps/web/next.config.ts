import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@hestia/types"],
  experimental: {
    serverActions: {
      allowedOrigins: ["localhost:3000"],
    },
  },
};

export default nextConfig;
