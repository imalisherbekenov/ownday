import type { NextConfig } from "next";
const config: NextConfig = {
  transpilePackages: ["@habits/core", "@habits/db", "@habits/services", "@habits/tokens"],
  serverExternalPackages: ["@prisma/client"],
};
export default config;
