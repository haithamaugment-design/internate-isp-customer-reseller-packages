import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  allowedDevOrigins: ["*.monkeycode-ai.live", "*.daytonaproxy01.net"],
  async rewrites() {
    const apiBase = process.env.API_URL ?? "http://localhost:3002";
    return [
      {
        source: "/api/:path*",
        destination: `${apiBase}/api/:path*`,
      },
    ];
  },
};

export default nextConfig;
