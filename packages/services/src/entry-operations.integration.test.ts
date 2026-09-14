import { afterAll, describe, expect, it } from "vitest";
import { randomUUID } from "node:crypto";
import { PrismaClient } from "@ownday/db";
import { prismaRepositories } from "./prisma.js";
import { createServices } from "./services.js";
import { consumeRateLimit } from "./rate-limit.js";

const url = process.env.TEST_DATABASE_URL;
if (url) {
  const target = new URL(url);
  if (
    !["127.0.0.1", "localhost", "::1", "[::1]"].includes(target.hostname) ||
    !target.pathname.startsWith("/ownday_test")
  )
    throw new Error("Integration tests require a dedicated local ownday_test database");
}
const db = url ? new PrismaClient({ datasources: { db: { url } } }) : null;
const owners: string[] = [];
const now = new Date("2026-09-13T12:00:00Z");
async function setup() {
  const repositories = prismaRepositories(db!);
  const services = createServices({ ...repositories, clock: () => now });
  const user = await repositories.users.createWithIdentity({
    provider: "email",
    externalId: `${randomUUID()}@test.invalid`,
    timezone: "UTC",
    dayStartHour: 4,
    locale: "en",
  });
  owners.push(user.id);
  const habit = await services.createHabit({
    userId: user.id,
    title: "Counter",
    type: "counter",
    targetValue: 8,
    schedule: { kind: "daily" },
    validFrom: "2026-09-01",
  });
  return {
    services,
    user,
    habit,
    base: {
      userId: user.id,
      habitId: habit.id,
      localDate: "2026-09-13",
      source: "mobile" as const,
    },
  };
}

describe.skipIf(!db)("entry operations on real PostgreSQL", () => {
  it("enforces a shared allowance under concurrent requests", async () => {
    const key = `test:${randomUUID()}`;
    try {
      const results = await Promise.all(
        Array.from({ length: 12 }, () => consumeRateLimit(db!, key, 3, 60000)),
      );
      expect(results.filter(Boolean)).toHaveLength(3);
    } finally {
      await db!.rateLimitWindow.deleteMany({ where: { key } });
    }
  });
  it("uses every scheduled habit for perfect days and retains archived history", async () => {
    const { services, base, user } = await setup();
    await services.applyEntryOperation({
      ...base,
      operationId: randomUUID(),
      action: { kind: "set", status: "done" },
    });
    const other = await services.createHabit({
      userId: user.id,
      title: "Other",
      type: "binary",
      validFrom: "2026-09-01",
      schedule: { kind: "daily" },
    });
    const summary = await services.getUserSummary(user.id, { days: 1 });
    expect(summary).toMatchObject({ perfectDays: 0, done: 1, due: 2 });
    expect(summary.habitSummaries.find((h) => h.habitId === base.habitId)?.trend).toEqual([1]);
    expect(summary.habitSummaries.find((h) => h.habitId === other.id)?.trend).toEqual([0]);
    await services.archiveHabit(other.id, user.id);
    expect(await services.getUserSummary(user.id, { days: 1 })).toMatchObject({
      perfectDays: 1,
      done: 1,
      due: 1,
    });
    expect((await services.getUserSummary(user.id, { days: 365 })).trend).toHaveLength(365);
  });
  afterAll(async () => {
    if (!db) return;
    // Only fixtures created in this run, never a whole-table reset.
    await db.user.deleteMany({ where: { id: { in: owners } } });
    await db.$disconnect();
  });
  it("replays an accepted operation without overwriting a newer edit or tombstone", async () => {
    const { services, base } = await setup();
    const input = {
      ...base,
      operationId: randomUUID(),
      baseRevision: 0,
      action: { kind: "set" as const, status: "done" as const, value: 8 },
    };
    const first = await services.applyEntryOperation(input);
    const clear = await services.applyEntryOperation({
      ...base,
      operationId: randomUUID(),
      baseRevision: 1,
      action: { kind: "clear" },
    });
    expect(clear.entry).toBeNull();
    expect(await services.applyEntryOperation(input)).toEqual(first);
    expect(await services.listEntriesForUser(base.userId, base.localDate, base.localDate)).toEqual(
      [],
    );
    const next = await services.applyEntryOperation({
      ...base,
      operationId: randomUUID(),
      baseRevision: 2,
      action: { kind: "increment", delta: 0.5 },
    });
    expect(next.entry).toMatchObject({ id: first.entry!.id, value: 0.5, revision: 3 });
    expect(await db!.entry.count({ where: { habitId: base.habitId } })).toBe(1);
  });
  it("sums concurrent independent deltas and deduplicates concurrent retries", async () => {
    const { services, base } = await setup();
    const operations = Array.from({ length: 8 }, () => ({
      ...base,
      operationId: randomUUID(),
      baseRevision: 0,
      action: { kind: "increment" as const, delta: 0.125 },
    }));
    await Promise.all(
      operations.flatMap((operation) => [
        services.applyEntryOperation(operation),
        services.applyEntryOperation(operation),
      ]),
    );
    expect(
      (await services.listEntriesForUser(base.userId, base.localDate, base.localDate))[0],
    ).toMatchObject({ value: 1, revision: 8 });
    expect(await db!.entryOperation.count({ where: { userId: base.userId } })).toBe(8);
  });
  it("retains both a stale absolute edit and the current value as a durable conflict", async () => {
    const { services, base } = await setup();
    await services.applyEntryOperation({
      ...base,
      operationId: randomUUID(),
      baseRevision: 0,
      action: { kind: "set", status: "miss", value: 2 },
    });
    const input = {
      ...base,
      operationId: randomUUID(),
      baseRevision: 0,
      action: { kind: "set" as const, status: "miss" as const, value: 5 },
    };
    const result = await services.applyEntryOperation(input);
    expect(result).toMatchObject({ outcome: "conflict", revision: 1, entry: { value: 2 } });
    expect(await services.applyEntryOperation(input)).toEqual(result);
    const saved = await db!.entryOperation.findUniqueOrThrow({
      where: { userId_operationId: { userId: base.userId, operationId: input.operationId } },
    });
    expect(saved.payload).toMatchObject({ action: { value: 5 } });
    expect(
      await services.applyEntryOperation({
        ...base,
        operationId: randomUUID(),
        baseRevision: 0,
        action: { kind: "increment", delta: 1 },
      }),
    ).toMatchObject({ outcome: "conflict" });
  });
  it("checks ownership before returning an operation result", async () => {
    const a = await setup(),
      b = await setup();
    const operationId = randomUUID();
    await a.services.applyEntryOperation({
      ...a.base,
      operationId,
      action: { kind: "increment", delta: 1 },
    });
    await expect(
      a.services.applyEntryOperation({
        ...a.base,
        userId: b.user.id,
        operationId,
        action: { kind: "increment", delta: 1 },
      }),
    ).rejects.toThrow("HABIT_NOT_FOUND");
    await expect(a.services.getHabitStats(a.habit.id, b.user.id)).rejects.toThrow(
      "HABIT_NOT_FOUND",
    );
  });
  it("restores partial progress after a skip and refuses invalid or future dates", async () => {
    const { services, base } = await setup();
    await services.applyEntryOperation({
      ...base,
      operationId: randomUUID(),
      action: { kind: "increment", delta: 2.5 },
    });
    await services.applyEntryOperation({
      ...base,
      operationId: randomUUID(),
      baseRevision: 1,
      action: { kind: "skip" },
    });
    expect(
      await services.applyEntryOperation({
        ...base,
        operationId: randomUUID(),
        baseRevision: 2,
        action: { kind: "unskip" },
      }),
    ).toMatchObject({ entry: { value: 2.5, status: "miss" } });
    for (const date of ["2026-02-30", "2026-09-14", "2026-08-30"])
      await expect(
        services.applyEntryOperation({
          ...base,
          localDate: date,
          operationId: randomUUID(),
          action: { kind: "increment", delta: 1 },
        }),
      ).rejects.toThrow();
  });
});
