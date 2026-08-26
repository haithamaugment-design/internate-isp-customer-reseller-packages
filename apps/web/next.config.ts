import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  allowedDevOrigins: ["*.monkeycode-ai.live", "*.daytonaproxy01.net"],
  // API rewrites removed — handled by custom server.ts which mounts Express on the same port.
};

export default nextConfig;
