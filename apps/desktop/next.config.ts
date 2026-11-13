import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Electron loads the exported `out/` directory at runtime.
  output: "export",
  transpilePackages: ["@logixzen/shared"],
  trailingSlash: false,
  images: {
    unoptimized: true,
  },
  experimental: {
    agentFeedback: true,
  },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
