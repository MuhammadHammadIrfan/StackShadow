import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Cloud Run buildpacks handle the start; no standalone needed
  experimental: {
    serverActions: {
      bodySizeLimit: "2mb",
    },
  },
};

export default nextConfig;
