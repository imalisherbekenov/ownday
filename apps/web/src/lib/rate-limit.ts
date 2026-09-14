import "server-only";
import { createHash } from "node:crypto";
import { PrismaClient } from "@ownday/db";
import { consumeRateLimit } from "@ownday/services";

/**
 * PostgreSQL in configured environments; the memory implementation is only for
 * local development and tests. Keys are hashed before persistence.
 */
const windows = new Map<string, number[]>();

const globalLimiter = globalThis as typeof globalThis & { __owndayRateDb?: PrismaClient };
export async function withinLimit(key: string, limit: number, windowMs: number, now = Date.now()) {
  if (process.env.DATABASE_URL) {
    const db = (globalLimiter.__owndayRateDb ??= new PrismaClient());
    const allowed = await consumeRateLimit(
      db,
      createHash("sha256").update(key).digest("hex"),
      limit,
      windowMs,
    );
    await db.rateLimitWindow.deleteMany({ where: { expiresAt: { lt: new Date(now - 86400000) } } });
    return allowed;
  }
  if (process.env.NODE_ENV === "production")
    throw new Error("DATABASE_URL is required for rate limiting");
  const fresh = (windows.get(key) ?? []).filter((at) => now - at < windowMs);
  const allowed = fresh.length < limit;
  if (allowed) fresh.push(now);
  windows.set(key, fresh);
  // Ключи копятся от каждого нового адреса, поэтому раз в несколько тысяч записей
  // выметаются те, у которых окно уже целиком в прошлом.
  if (windows.size > 5_000)
    for (const [key, hits] of windows)
      if (!hits.some((at) => now - at < windowMs)) windows.delete(key);
  return allowed;
}

export function resetLimits() {
  windows.clear();
}
