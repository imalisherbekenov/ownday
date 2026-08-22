import type { NextConfig } from "next";
const config: NextConfig = {
  transpilePackages: ["@ownday/core", "@ownday/db", "@ownday/services", "@ownday/tokens"],
  serverExternalPackages: ["@prisma/client"],
};
export default config;
