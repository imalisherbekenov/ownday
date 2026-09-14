import { PrismaClient } from "@ownday/db";
import { SyncService } from "@ownday/services";
import { assertSyncOperation } from "@ownday/core";
import type { SyncOperation } from "@ownday/core";
import { authTokens } from "@/lib/auth-tokens";
import { withinLimit } from "@/lib/rate-limit";
import { boundedJson } from "@/lib/bounded-json";
import { observeRequest } from "@/lib/observe-request";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const scope = globalThis as typeof globalThis & { __owndaySyncDb?: PrismaClient };
const service = () => new SyncService((scope.__owndaySyncDb ??= new PrismaClient()));
const reply = (body: unknown, status = 200) =>
  Response.json(body, { status, headers: { "Cache-Control": "no-store" } });
async function owner(request: Request) {
  const header = request.headers.get("authorization");
  // This endpoint uses native bearer sessions only; cookies cannot authorize writes.
  return header?.startsWith("Bearer od1_") ? authTokens().verify(header.slice(7)) : null;
}
async function readSnapshot(request: Request) {
  const userId = await owner(request);
  if (!userId) return reply({ error: "UNAUTHORIZED" }, 401);
  if (!(await withinLimit(`sync:read:${userId}`, 60, 60000)))
    return reply({ error: "RATE_LIMITED" }, 429);
  return reply(await service().snapshot(userId));
}
async function writeOperation(request: Request) {
  const userId = await owner(request);
  if (!userId) return reply({ error: "UNAUTHORIZED" }, 401);
  if (!(await withinLimit(`sync:write:${userId}`, 600, 60000)))
    return reply({ error: "RATE_LIMITED" }, 429);
  let operation: SyncOperation;
  try {
    operation = (await boundedJson(request)) as SyncOperation;
    assertSyncOperation(operation);
  } catch (error) {
    const code = error instanceof Error ? error.message : "INVALID_OPERATION";
    return reply({ error: code }, code === "BODY_TOO_LARGE" ? 413 : 400);
  }
  try {
    return reply(await service().change(userId, operation));
  } catch (error) {
    const code = error instanceof Error ? error.message : "INTERNAL_ERROR";
    if (code === "HABIT_NOT_FOUND") return reply({ error: code }, 404);
    if (["DEPENDENCY_NOT_FOUND", "OPERATION_ID_REUSED"].includes(code))
      return reply({ error: code }, 409);
    throw error;
  }
}
export async function GET(request: Request) {
  return observeRequest("sync.read", () => readSnapshot(request));
}
export async function POST(request: Request) {
  return observeRequest("sync.write", () => writeOperation(request));
}
