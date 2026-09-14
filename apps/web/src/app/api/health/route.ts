import { createHash, timingSafeEqual } from "node:crypto";
import { PrismaClient } from "@ownday/db";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const scope = globalThis as typeof globalThis & { __owndayHealthDb?: PrismaClient };
const reply = (body: unknown, status: number) =>
  Response.json(body, { status, headers: { "Cache-Control": "no-store" } });
export async function GET(request: Request) {
  const expected = process.env.OPS_HEALTH_TOKEN;
  if (!expected || expected.length < 32) return reply({ status: "not_configured" }, 503);
  const supplied = request.headers.get("authorization") ?? "";
  const hash = (value: string) => createHash("sha256").update(value).digest();
  if (!timingSafeEqual(hash(supplied), hash(`Bearer ${expected}`)))
    return reply({ status: "unauthorized" }, 401);
  if (!process.env.DATABASE_URL) return reply({ status: "unavailable" }, 503);
  const db = (scope.__owndayHealthDb ??= new PrismaClient());
  try {
    const queue = await db.$transaction(
      async (tx) => {
        await tx.$executeRaw`SET LOCAL statement_timeout = '1500ms'`;
        await tx.$queryRaw`SELECT 1`;
        const failed = await tx.reminderDelivery.count({ where: { status: "failed" } });
        const oldest = await tx.reminderDelivery.findFirst({
          where: { status: "pending" },
          orderBy: { scheduledAt: "asc" },
          select: { scheduledAt: true },
        });
        return {
          failed,
          oldestPendingSeconds: oldest
            ? Math.max(0, Math.floor((Date.now() - oldest.scheduledAt.valueOf()) / 1000))
            : 0,
        };
      },
      { maxWait: 1000, timeout: 2500 },
    );
    return reply({ status: "ready", queue }, 200);
  } catch {
    return reply({ status: "unavailable" }, 503);
  }
}
