import { afterAll, describe, it, expect } from "vitest";
import { randomUUID } from "node:crypto";
import { DatabaseSync } from "node:sqlite";
import { PrismaClient } from "@ownday/db";
import { LocalStore } from "../../../apps/mobile/src/local-store";
import type { LocalDatabase } from "../../../apps/mobile/src/local-store";
import { SyncEngine } from "../../../apps/mobile/src/sync-engine";
import type { SyncTransport } from "../../../apps/mobile/src/sync-engine";
import { SyncService } from "./sync.js";
const url = process.env.TEST_DATABASE_URL;
if (url) {
  const target = new URL(url);
  if (
    !["localhost", "127.0.0.1", "[::1]"].includes(target.hostname) ||
    !target.pathname.startsWith("/ownday_test")
  )
    throw new Error("Dedicated local test database required");
}
const db = url ? new PrismaClient({ datasources: { db: { url } } }) : null;
const owners: string[] = [],
  locals: DatabaseSync[] = [];
const clock = () => new Date("2026-09-13T12:00:00Z");
function client() {
  const local = new DatabaseSync(":memory:");
  locals.push(local);
  const adapter: LocalDatabase = {
    execSync: (sql) => local.exec(sql),
    runSync: (sql, ...params) => local.prepare(sql).run(...params),
    getFirstSync: <T>(sql: string, ...params: Array<string | number | null>) =>
      (local.prepare(sql).get(...params) ?? null) as T | null,
    getAllSync: <T>(sql: string, ...params: Array<string | number | null>) =>
      local.prepare(sql).all(...params) as T[],
  };
  const store = new LocalStore(adapter, randomUUID, clock);
  store.savePreferences({ timezone: "UTC" });
  return { store, engine: new SyncEngine(store) };
}
async function account() {
  const user = await db!.user.create({ data: { timezone: "UTC", locale: "ru" } });
  owners.push(user.id);
  const service = new SyncService(db!, clock);
  const wire = <T>(value: T): T => JSON.parse(JSON.stringify(value));
  const transport: SyncTransport = {
    snapshot: async () => wire(await service.snapshot(user.id)),
    change: async (operation) => wire(await service.change(user.id, wire(operation))),
  };
  return { userId: user.id, transport };
}
describe.skipIf(!db)("two SQLite devices through the PostgreSQL sync contract", () => {
  it("merges increments, preserves an undo conflict and accepts the next edit at the tombstone revision", async () => {
    const { userId, transport } = await account(),
      a = client(),
      b = client();
    const habit = a.store.createHabit({
        title: "Вода",
        type: "counter",
        targetValue: 8,
        unit: "стак.",
        icon: "water",
        time: "morning",
        schedule: { kind: "daily" },
      }),
      day = a.store.today();
    a.store.mark(habit.id, day, { kind: "increment", delta: 2.5 });
    a.store.attachAccount(await transport.snapshot(), true);
    await a.engine.run(userId, transport);
    b.store.attachAccount(await transport.snapshot(), true);
    a.store.mark(habit.id, day, { kind: "increment", delta: 1 });
    b.store.mark(habit.id, day, { kind: "increment", delta: 2 });
    await Promise.all([a.engine.run(userId, transport), b.engine.run(userId, transport)]);
    await a.engine.run(userId, transport);
    await b.engine.run(userId, transport);
    expect(a.store.snapshot().entries[0]?.value).toBe(5.5);
    expect(b.store.snapshot().entries[0]?.value).toBe(5.5);
    a.store.mark(habit.id, day, { kind: "clear" });
    b.store.mark(habit.id, day, { kind: "increment", delta: 1 });
    await a.engine.run(userId, transport);
    await b.engine.run(userId, transport);
    expect(b.store.snapshot()).toMatchObject({ conflicts: 1, entries: [{ value: 6.5 }] });
    const conflict = b.store.outbox()[0]!;
    b.store.resolveConflict(conflict.id, "remote");
    expect(b.store.snapshot().entries[0]).toMatchObject({ deleted: true, revision: 4 });
    expect(b.store.conflictHistory()[0].remote).toMatchObject({ deleted: true, revision: 4 });
    b.store.mark(habit.id, day, { kind: "increment", delta: 0.5 });
    await b.engine.run(userId, transport);
    expect((await transport.snapshot()).entries[0]).toMatchObject({
      value: 0.5,
      revision: 5,
      deleted: false,
    });
  });
  it("does not duplicate an accepted change when its HTTP response is lost", async () => {
    const { userId, transport } = await account(),
      a = client();
    const habit = a.store.createHabit({
      title: "Вода",
      type: "counter",
      targetValue: 8,
      unit: "",
      icon: "water",
      time: "morning",
      schedule: { kind: "daily" },
    });
    a.store.attachAccount(await transport.snapshot(), true);
    await a.engine.run(userId, transport);
    a.store.mark(habit.id, a.store.today(), { kind: "increment", delta: 1 });
    a.store.mark(habit.id, a.store.today(), { kind: "increment", delta: 2 });
    let lose = true;
    const unreliable: SyncTransport = {
      ...transport,
      change: async (operation) => {
        const result = await transport.change(operation);
        if (lose) {
          lose = false;
          throw new Error("RESPONSE_LOST");
        }
        return result;
      },
    };
    await expect(a.engine.run(userId, unreliable)).rejects.toThrow("RESPONSE_LOST");
    expect(a.store.outbox()).toHaveLength(2);
    await a.engine.run(userId, unreliable);
    expect(a.store.snapshot().entries[0]).toMatchObject({ value: 3, revision: 2 });
    expect(a.store.outbox()).toEqual([]);
  });
});
afterAll(async () => {
  for (const local of locals) local.close();
  if (db) {
    await db.user.deleteMany({ where: { id: { in: owners } } });
    await db.$disconnect();
  }
});
