import type { PrismaClient } from "@ownday/db";

/** One atomic, database-clock window shared by every server instance. */
export async function consumeRateLimit(
  db: PrismaClient,
  key: string,
  limit: number,
  windowMs: number,
) {
  if (!Number.isInteger(limit) || limit < 1 || !Number.isInteger(windowMs) || windowMs < 1)
    throw new Error("INVALID_LIMIT");
  const rows = await db.$queryRaw<Array<{ hits: number }>>`
    INSERT INTO "RateLimitWindow" ("key", "hits", "expiresAt")
    VALUES (${key}, 1, (CURRENT_TIMESTAMP AT TIME ZONE 'UTC') + ${windowMs} * INTERVAL '1 millisecond')
    ON CONFLICT ("key") DO UPDATE SET
      "hits" = CASE WHEN "RateLimitWindow"."expiresAt" <= (CURRENT_TIMESTAMP AT TIME ZONE 'UTC') THEN 1 ELSE LEAST("RateLimitWindow"."hits" + 1, 1000000) END,
      "expiresAt" = CASE WHEN "RateLimitWindow"."expiresAt" <= (CURRENT_TIMESTAMP AT TIME ZONE 'UTC') THEN (CURRENT_TIMESTAMP AT TIME ZONE 'UTC') + ${windowMs} * INTERVAL '1 millisecond' ELSE "RateLimitWindow"."expiresAt" END
    RETURNING "hits"`;
  return rows[0]!.hits <= limit;
}
