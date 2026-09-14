import { describe, expect, it } from "vitest";
import { randomUUID } from "node:crypto";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { PrismaClient } from "@ownday/db";
import { PrismaEntryRepository } from "./prisma.js";
const url = process.env.TEST_DATABASE_URL;
if (url) {
  const target = new URL(url);
  if (
    !["127.0.0.1", "localhost", "[::1]"].includes(target.hostname) ||
    !target.pathname.startsWith("/ownday_test")
  )
    throw new Error("Dedicated local test database required");
}
const root = fileURLToPath(new URL("../../../", import.meta.url));
function prisma(args: string[], databaseUrl: string) {
  const result = spawnSync(
    process.execPath,
    ["packages/db/node_modules/prisma/build/index.js", ...args],
    {
      cwd: root,
      env: { ...process.env, DATABASE_URL: databaseUrl },
      encoding: "utf8",
      timeout: 30000,
    },
  );
  if (result.status !== 0) throw new Error(`Migration command failed: ${result.stderr}`);
}
describe.skipIf(!url)("migration of existing account history", () => {
  it("preserves identifiers, decimals and the original replay result across the full migration chain", async () => {
    const database = `ownday_test_migration_${randomUUID().replace(/-/g, "")}`,
      target = new URL(url!);
    target.pathname = `/${database}`;
    target.searchParams.delete("schema");
    const admin = new PrismaClient({ datasources: { db: { url: url! } } }),
      db = new PrismaClient({ datasources: { db: { url: target.toString() } } });
    const userId = randomUUID(),
      habitId = randomUUID(),
      entryId = randomUUID(),
      clientId = randomUUID();
    try {
      await admin.$executeRawUnsafe(`CREATE DATABASE "${database}"`);
      prisma(
        [
          "db",
          "execute",
          "--file",
          "packages/db/prisma/migrations/20260822162457_init/migration.sql",
          "--url",
          target.toString(),
        ],
        target.toString(),
      );
      await db.$executeRaw`INSERT INTO "User" ("id","timezone","locale") VALUES (${userId}::uuid,'Asia/Tashkent','ru')`;
      await db.$executeRaw`INSERT INTO "Habit" ("id","userId","title","icon","color","category","type","targetValue") VALUES (${habitId}::uuid,${userId}::uuid,'Вода','water','moss','general','counter',8)`;
      await db.$executeRaw`INSERT INTO "ScheduleVersion" ("id","habitId","kind","config","validFrom") VALUES (${randomUUID()}::uuid,${habitId}::uuid,'daily','{}'::jsonb,'2026-09-01'::date)`;
      await db.$executeRaw`INSERT INTO "Entry" ("id","habitId","userId","localDate","value","status","source","clientId","updatedAt") VALUES (${entryId}::uuid,${habitId}::uuid,${userId}::uuid,'2026-09-13'::date,2.5,'miss','mobile',${clientId}::uuid,'2026-09-13T10:00:00'::timestamp)`;
      prisma(
        [
          "migrate",
          "resolve",
          "--applied",
          "20260822162457_init",
          "--schema",
          "packages/db/prisma/schema.prisma",
        ],
        target.toString(),
      );
      prisma(
        ["migrate", "deploy", "--schema", "packages/db/prisma/schema.prisma"],
        target.toString(),
      );
      const saved = await db.entry.findUniqueOrThrow({ where: { id: entryId } });
      expect(saved.userId).toBe(userId);
      expect(saved.clientId).toBe(clientId);
      expect(Number(saved.value)).toBe(2.5);
      expect(saved.revision).toBe(0);
      expect(await db.user.count()).toBe(1);
      expect(await db.habit.count()).toBe(1);
      const entries = new PrismaEntryRepository(db),
        base = {
          userId,
          habitId,
          localDate: "2026-09-13",
          source: "mobile" as const,
          now: new Date("2026-09-13T12:00:00Z"),
        };
      await entries.applyOperation({
        ...base,
        operationId: randomUUID(),
        baseRevision: 0,
        action: { kind: "clear" },
      });
      const replay = await entries.applyOperation({
        ...base,
        operationId: clientId,
        action: { kind: "set", status: "done" },
      });
      expect(replay.entry).toMatchObject({ id: entryId, value: 2.5, status: "miss", revision: 0 });
      expect((await db.entry.findUniqueOrThrow({ where: { id: entryId } })).deleted).toBe(true);
    } finally {
      await db.$disconnect();
      if (!/^ownday_test_migration_[0-9a-f]{32}$/.test(database))
        throw new Error("Unsafe cleanup database");
      await admin.$executeRawUnsafe(`DROP DATABASE IF EXISTS "${database}"`);
      await admin.$disconnect();
    }
  }, 60000);
});
