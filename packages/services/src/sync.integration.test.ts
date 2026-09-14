import { afterAll, describe, expect, it } from "vitest";
import { randomUUID } from "node:crypto";
import { PrismaClient } from "@ownday/db";
import type { HabitSnapshot } from "@ownday/core";
import { SyncService } from "./sync.js";
import { PrismaHabitRepository } from "./prisma.js";
const url = process.env.TEST_DATABASE_URL;
if (url) {
  const target = new URL(url);
  if (
    !["127.0.0.1", "localhost", "[::1]"].includes(target.hostname) ||
    !target.pathname.startsWith("/ownday_test")
  )
    throw new Error("Dedicated local test database required");
}
const db = url ? new PrismaClient({ datasources: { db: { url } } }) : null,
  owners: string[] = [];
const now = new Date("2026-09-13T12:00:00Z"),
  day = "2026-09-13";
async function setup() {
  const user = await db!.user.create({ data: { timezone: "UTC", locale: "ru" } });
  owners.push(user.id);
  const sync = new SyncService(db!, () => now),
    habit: HabitSnapshot = {
      id: randomUUID(),
      title: "Вода",
      type: "counter",
      targetValue: 8,
      unit: "стак.",
      icon: "water",
      time: "morning",
      scheduleVersions: [{ validFrom: day, schedule: { kind: "daily" } }],
      startedOn: day,
      sortOrder: 0,
      archivedOn: null,
      inactiveRanges: [],
      revision: 1,
      createdAt: now.toISOString(),
    };
  await sync.change(user.id, {
    kind: "habit",
    change: { operationId: randomUUID(), baseRevision: 0, habit },
  });
  return { sync, habit, userId: user.id };
}
describe.skipIf(!db)("sync contract on PostgreSQL", () => {
  it("does not delete entries when a habit was restored after the archive screen loaded", async () => {
    const { sync, habit, userId } = await setup();
    await sync.change(userId, {
      kind: "entry",
      change: {
        operationId: randomUUID(),
        habitId: habit.id,
        localDate: day,
        baseRevision: 0,
        action: { kind: "increment", delta: 2.5 },
      },
    });
    const repo = new PrismaHabitRepository(db!);
    await repo.archive(habit.id, userId, now);
    await repo.restore(habit.id, userId, now);
    expect(await repo.delete(habit.id, userId, true)).toBe(false);
    expect((await sync.snapshot(userId)).entries[0]?.value).toBe(2.5);
  });
  it("retains the client intent for conflict export without using it as the mutation value", async () => {
    const { sync, habit, userId } = await setup();
    const first = await sync.change(
      userId,
      {
        kind: "entry",
        change: {
          operationId: randomUUID(),
          habitId: habit.id,
          localDate: day,
          baseRevision: 0,
          action: { kind: "increment", delta: 1 },
          clientIntent: { value: 999, status: "done", deleted: false },
        },
      },
      "web",
    );
    expect(first).toMatchObject({ entry: { value: 1 } });
    expect(await db!.entry.findFirst({ where: { userId } })).toMatchObject({ source: "web" });
    const id = randomUUID();
    await sync.change(userId, {
      kind: "entry",
      change: {
        operationId: id,
        habitId: habit.id,
        localDate: day,
        baseRevision: 0,
        action: { kind: "clear" },
        clientIntent: { value: 0, status: "miss", deleted: true },
      },
    });
    const history = await sync.operationHistory(userId);
    expect(history.entries.find((e) => e.operationId === id)).toMatchObject({
      payload: { clientIntent: { value: 0, deleted: true } },
      result: { outcome: "conflict", entry: { value: 1 } },
    });
    const other = await setup();
    expect((await sync.operationHistory(other.userId)).entries).toEqual([]);
  });
  it("cannot resurrect a permanently deleted habit by replaying an offline create", async () => {
    const { sync, habit, userId } = await setup();
    await new PrismaHabitRepository(db!).delete(habit.id, userId);
    expect(
      await sync.change(userId, {
        kind: "habit",
        change: { operationId: randomUUID(), baseRevision: 0, habit },
      }),
    ).toMatchObject({ outcome: "conflict", reason: "HABIT_DELETED", habit: null });
    expect(
      await sync.change(userId, {
        kind: "entry",
        change: {
          operationId: randomUUID(),
          habitId: habit.id,
          localDate: day,
          baseRevision: 0,
          action: { kind: "increment", delta: 1 },
        },
      }),
    ).toMatchObject({ outcome: "conflict", reason: "HABIT_DELETED" });
    expect((await sync.snapshot(userId)).habits).toEqual([]);
  });
  it("uses an acknowledged dependency revision after another device has incremented", async () => {
    const { sync, habit, userId } = await setup(),
      first = randomUUID(),
      second = randomUUID();
    const base = { habitId: habit.id, localDate: day, baseRevision: 0 };
    await sync.change(userId, {
      kind: "entry",
      change: { ...base, operationId: first, action: { kind: "increment", delta: 1 } },
    });
    await sync.change(userId, {
      kind: "entry",
      change: { ...base, operationId: randomUUID(), action: { kind: "increment", delta: 2 } },
    });
    const next = await sync.change(userId, {
      kind: "entry",
      change: {
        ...base,
        baseRevision: 1,
        dependsOn: first,
        operationId: second,
        action: { kind: "increment", delta: 1 },
      },
    });
    expect(next).toMatchObject({ outcome: "applied", revision: 3, entry: { value: 4 } });
    expect(
      await sync.change(userId, {
        kind: "entry",
        change: {
          ...base,
          baseRevision: 2,
          dependsOn: second,
          operationId: randomUUID(),
          action: { kind: "clear" },
        },
      }),
    ).toMatchObject({ outcome: "applied", revision: 4, entry: { deleted: true, revision: 4 } });
    expect((await sync.snapshot(userId)).entries[0]).toMatchObject({ deleted: true, revision: 4 });
  });
  it("keeps an unseen increment when an absolute offline edit conflicts", async () => {
    const { sync, habit, userId } = await setup(),
      first = randomUUID(),
      base = { habitId: habit.id, localDate: day, baseRevision: 0 };
    await sync.change(userId, {
      kind: "entry",
      change: { ...base, operationId: first, action: { kind: "increment", delta: 1 } },
    });
    await sync.change(userId, {
      kind: "entry",
      change: { ...base, operationId: randomUUID(), action: { kind: "increment", delta: 2 } },
    });
    const edit = {
      ...base,
      baseRevision: 1,
      dependsOn: first,
      operationId: randomUUID(),
      action: { kind: "set" as const, status: "done" as const, value: 8 },
    };
    const result = await sync.change(userId, { kind: "entry", change: edit });
    expect(result).toMatchObject({ outcome: "conflict", entry: { value: 3 } });
    expect(await sync.change(userId, { kind: "entry", change: edit })).toEqual(result);
  });
  it("retains both metadata versions and scopes receipts to the owner", async () => {
    const a = await setup(),
      b = await setup(),
      operationId = randomUUID();
    await a.sync.change(a.userId, {
      kind: "habit",
      change: {
        operationId,
        baseRevision: 1,
        habit: { ...a.habit, title: "Новое название", revision: 2 },
      },
    });
    const conflict = await a.sync.change(a.userId, {
      kind: "habit",
      change: {
        operationId: randomUUID(),
        baseRevision: 1,
        habit: {
          ...a.habit,
          archivedOn: day,
          inactiveRanges: [{ from: day, through: null }],
          revision: 2,
        },
      },
    });
    expect(conflict).toMatchObject({
      outcome: "conflict",
      habit: { title: "Новое название", archivedOn: null },
    });
    await expect(
      b.sync.change(b.userId, {
        kind: "habit",
        change: { operationId, baseRevision: 1, habit: a.habit },
      }),
    ).rejects.toThrow("HABIT_NOT_FOUND");
  });
});
afterAll(async () => {
  if (db) {
    await db.user.deleteMany({ where: { id: { in: owners } } });
    await db.$disconnect();
  }
});
