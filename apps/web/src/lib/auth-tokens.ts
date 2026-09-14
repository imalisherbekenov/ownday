import "server-only";
import { PrismaClient } from "@ownday/db";
import { AuthTokens } from "@ownday/services";
const scope = globalThis as typeof globalThis & { __owndayAuthDb?: PrismaClient };
export function authTokens() {
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is required for authentication");
  return new AuthTokens((scope.__owndayAuthDb ??= new PrismaClient()));
}
