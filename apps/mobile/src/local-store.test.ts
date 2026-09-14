import { afterEach, describe, expect, it } from "vitest";
import { DatabaseSync } from "node:sqlite";
import { randomUUID } from "node:crypto";
import { mkdtempSync, rmSync, realpathSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname, basename } from "node:path";
import { LocalStore } from "./local-store";
import type { LocalDatabase } from "./local-store";
import type { SyncSnapshot, SyncResult, EntrySnapshot } from "@ownday/core";
import { SyncEngine } from "./sync-engine";
import { journalWidgetSnapshot } from "./journal-widget-snapshot";
const databases: DatabaseSync[] = [];
const directories: string[] = [];
function adapter(db: DatabaseSync): LocalDatabase {
  return {
    execSync: (sql) => db.exec(sql),
    runSync: (sql, ...params) => db.prepare(sql).run(...params),
    getAllSync: <T>(sql: string, ...params: Array<string | number | null>) =>
      db.prepare(sql).all(...params) as T[],
    getFirstSync: <T>(sql: string, ...params: Array<string | number | null>) =>
      (db.prepare(sql).get(...params) ?? null) as T | null,
  };
}
function open(path = ":memory:") {
  const db = new DatabaseSync(path);
  databases.push(db);
  return {
    db,
    store: new LocalStore(adapter(db), randomUUID, () => new Date("2026-09-13T12:00:00Z")),
  };
}
function habit(store: LocalStore) {
  return store.createHabit({
    title: "Пить воду",
    type: "counter",
    targetValue: 8,
    unit: "стак.",
    time: "morning",
    icon: "water",
    schedule: { kind: "daily" },
  });
}
afterEach(() => {
  for (const db of databases.splice(0)) {
    try {
      db.close();
    } catch {}
  }
  for (const dir of directories.splice(0)) {
    const resolved = realpathSync(dir);
    if (
      dirname(resolved) !== realpathSync(tmpdir()) ||
      !basename(resolved).startsWith("ownday-sqlite-")
    )
      throw new Error("Unsafe cleanup path");
    rmSync(resolved, { recursive: true, force: true });
  }
});
describe("local SQLite persistence", () => {
  it("removes an account and its transferred guest copy while keeping other profiles isolated", () => {
    const { store, db } = open(),
      h = habit(store),
      source = store.profileId,
      userId = randomUUID();
    const remote: SyncSnapshot = {
      userId,
      habits: [],
      entries: [],
      preferences: { timezone: "UTC", dayStartHour: 0, locale: "ru" },
    };
    store.attachAccount(remote, true);
    store.ensureProfile("account:unrelated");
    store.forgetAccount(userId);
    expect(store.profileId).toMatch(/^guest:/);
    expect(store.snapshot().habits).toEqual([]);
    expect(db.prepare("SELECT id FROM profiles WHERE id=?").get(source)).toBeUndefined();
    expect(
      db.prepare("SELECT id FROM profiles WHERE id=?").get(`account:${userId}`),
    ).toBeUndefined();
    expect(db.prepare("SELECT id FROM profiles WHERE id=?").get("account:unrelated")).toBeTruthy();
    expect(
      store.importWidgetOperation(source, {
        operationId: randomUUID(),
        habitId: h.id,
        localDate: store.today(),
        baseRevision: 0,
        action: { kind: "increment", delta: 1 },
      }),
    ).toBe(true);
    expect(store.snapshot().habits).toEqual([]);
  });
  it.each(["ownday.mutation-queue.v1", "ownday.widget.pending.v1"])(
    "recovers %s only for owned habits and only once, requiring a visible choice",
    (source) => {
      const { store } = open(),
        h = habit(store),
        foreign = { ...h, id: randomUUID() },
        userId = randomUUID(),
        profile = `account:${userId}`;
      store.captureLegacy([
        [
          source,
          JSON.stringify([
            {
              clientId: "legacy-non-uuid",
              habitId: h.id,
              localDate: store.today(),
              status: "done",
            },
            {
              clientId: "other-user",
              habitId: foreign.id,
              localDate: store.today(),
              status: "done",
            },
          ]),
        ],
      ]);
      const remote: SyncSnapshot = {
        userId,
        habits: [h],
        entries: [],
        preferences: store.snapshot().preferences,
      };
      store.attachAccount(remote, false);
      store.importLegacyReviews(remote);
      expect(store.snapshot().conflicts).toBe(1);
      expect(store.outbox()).toHaveLength(1);
      expect(store.snapshot().entries[0]).toMatchObject({ habitId: h.id, value: 8 });
      expect(JSON.parse(store.outbox()[0]!.result!)).toMatchObject({
        reason: "LEGACY_REVIEW",
        legacy: { clientId: "legacy-non-uuid" },
      });
      store.resolveConflict(store.outbox()[0]!.id, "remote");
      store.importLegacyReviews(remote);
      expect(store.outbox()).toEqual([]);
      expect(store.profileId).toBe(profile);
      expect(JSON.parse(store.exportData()).recoveredLegacyActions).toHaveLength(1);
      expect(store.conflictHistory()[0].operations[0].result).toContain("legacy-non-uuid");
    },
  );
  it("transfers the guest transactionally and cannot leak that history to another account", () => {
    const { store } = open(),
      h = habit(store);
    store.mark(h.id, store.today(), { kind: "increment", delta: 2.5 });
    const userId = randomUUID(),
      snapshot: SyncSnapshot = {
        userId,
        habits: [],
        entries: [],
        preferences: store.snapshot().preferences,
      };
    store.attachAccount(snapshot, true);
    expect(store.snapshot().habits[0]?.id).toBe(h.id);
    expect(store.snapshot().entries[0]?.value).toBe(2.5);
    expect(store.outbox()).toHaveLength(2);
    store.activateGuest();
    expect(store.snapshot().habits).toEqual([]);
    store.attachAccount({ ...snapshot, userId: randomUUID() }, true);
    expect(store.snapshot().habits).toEqual([]);
    store.activateProfile("guest");
    expect(store.snapshot().entries[0]?.value).toBe(2.5);
    expect(() => store.attachAccount(snapshot, true)).toThrow("GUEST_ALREADY_TRANSFERRED");
  });
  it("retries the same operation after a lost response and continues its dependent chain", async () => {
    const { store } = open(),
      h = habit(store),
      userId = randomUUID();
    store.attachAccount(
      { userId, habits: [], entries: [], preferences: store.snapshot().preferences },
      true,
    );
    const create = store.outbox()[0]!;
    store.acknowledge(store.profileId, {
      kind: "habit",
      operationId: create.id,
      outcome: "applied",
      revision: 1,
      habit: h,
    });
    store.mark(h.id, store.today(), { kind: "increment", delta: 1 });
    const first = store.outbox()[0]!,
      engine = new SyncEngine(store),
      received: string[] = [];
    let loseResponse = true;
    const entry: EntrySnapshot = {
      id: randomUUID(),
      habitId: h.id,
      localDate: store.today(),
      status: "miss",
      value: 1,
      revision: 1,
      resetRevision: 0,
      deleted: false,
    };
    const transport = {
      snapshot: async () => ({
        userId,
        habits: [h],
        entries: [entry],
        preferences: store.snapshot().preferences,
      }),
      change: async (operation: import("@ownday/core").SyncOperation): Promise<SyncResult> => {
        received.push(operation.change.operationId);
        if (loseResponse) {
          loseResponse = false;
          throw new Error("NETWORK_LOST");
        }
        return {
          kind: "entry",
          operationId: operation.change.operationId,
          outcome: "applied",
          revision: 1,
          entry,
        };
      },
    };
    await expect(engine.run(userId, transport)).rejects.toThrow("NETWORK_LOST");
    expect(store.outbox()[0]?.id).toBe(first.id);
    await engine.run(userId, transport);
    expect(received).toEqual([first.id, first.id]);
    expect(store.snapshot().entries[0]?.value).toBe(1);
    expect(store.outbox()).toHaveLength(0);
  });
  it("rebases the visible counter after a merged acknowledgement without double-applying a retry", () => {
    const { store } = open(),
      h = habit(store),
      profile = `account:${randomUUID()}`;
    store.ensureProfile(profile);
    store.activateProfile(profile);
    const baseline: SyncSnapshot = {
      userId: profile.slice(8),
      habits: [h],
      entries: [],
      preferences: store.snapshot().preferences,
    };
    store.acceptSnapshot(profile, baseline);
    store.mark(h.id, store.today(), { kind: "increment", delta: 1 });
    store.mark(h.id, store.today(), { kind: "increment", delta: 1 });
    const [first, second] = store.outbox();
    expect(store.operation(second!).change.dependsOn).toBe(first!.id);
    const entry: EntrySnapshot = {
      id: randomUUID(),
      habitId: h.id,
      localDate: store.today(),
      status: "miss",
      value: 3,
      revision: 2,
      resetRevision: 0,
      deleted: false,
    };
    const result: SyncResult = {
      kind: "entry",
      operationId: first!.id,
      outcome: "applied",
      revision: 2,
      entry,
    };
    store.acknowledge(profile, result);
    expect(store.snapshot().entries[0]).toMatchObject({ value: 4, revision: 3 });
    expect(store.operation(store.outbox()[0]!).change.baseRevision).toBe(1);
    store.acknowledge(profile, result);
    expect(store.snapshot().entries[0]?.value).toBe(4);
    store.acceptSnapshot(profile, { ...baseline, entries: [entry] });
    expect(store.snapshot().entries[0]?.value).toBe(4);
    store.acknowledge(profile, {
      ...result,
      operationId: second!.id,
      revision: 3,
      entry: { ...entry, value: 4, revision: 3 },
    });
    expect(store.snapshot().entries[0]?.value).toBe(4);
    expect(store.outbox()).toEqual([]);
  });
  it("keeps both versions and dependent edits when resolving a conflict", () => {
    const { store } = open(),
      h = habit(store),
      profile = `account:${randomUUID()}`;
    store.ensureProfile(profile);
    store.activateProfile(profile);
    store.acceptSnapshot(profile, {
      userId: profile.slice(8),
      habits: [h],
      entries: [],
      preferences: store.snapshot().preferences,
    });
    store.mark(h.id, store.today(), { kind: "set", status: "done", value: 2 });
    store.mark(h.id, store.today(), { kind: "increment", delta: 0.5 });
    const first = store.outbox()[0]!;
    store.acknowledge(profile, {
      kind: "entry",
      operationId: first.id,
      outcome: "conflict",
      revision: 1,
      entry: {
        id: randomUUID(),
        habitId: h.id,
        localDate: store.today(),
        status: "miss",
        value: 6,
        revision: 1,
        resetRevision: 0,
        deleted: false,
      },
    });
    expect(store.snapshot().entries[0]?.value).toBe(2.5);
    store.resolveConflict(first.id, "local");
    expect(store.outbox()).toHaveLength(1);
    expect(store.operation(store.outbox()[0]!).change).toMatchObject({
      baseRevision: 1,
      action: { kind: "set", value: 2.5 },
    });
    expect(store.conflictHistory()[0]).toMatchObject({
      choice: "local",
      local: { value: 2.5 },
      remote: { value: 6 },
    });
    expect(store.conflictHistory()[0].operations).toHaveLength(2);
  });
  it("rejects a response that arrives after switching accounts", () => {
    const { store } = open(),
      profile = `account:${randomUUID()}`;
    store.ensureProfile(profile);
    store.activateProfile(profile);
    store.activateProfile("guest");
    expect(() =>
      store.acceptSnapshot(profile, {
        userId: profile.slice(8),
        habits: [],
        entries: [],
        preferences: store.snapshot().preferences,
      }),
    ).toThrow("PROFILE_CHANGED");
    expect(store.profileId).toBe("guest");
  });
  it("restores the amount behind a skipped entry when undoing a later completion", () => {
    const { store } = open(),
      h = habit(store),
      date = store.today();
    store.mark(h.id, date, { kind: "set", status: "skip", value: 2.5 });
    const previous = store.snapshot().entries[0]!;
    store.mark(h.id, date, { kind: "set", status: "done" });
    store.mark(h.id, date, { kind: "set", status: previous.status, value: previous.value });
    store.mark(h.id, date, { kind: "unskip" });
    expect(store.snapshot().entries[0]).toMatchObject({ value: 2.5, status: "miss" });
  });
  it("preserves a stale widget action for review, deduplicates it and isolates its profile", () => {
    const { store } = open();
    const h = habit(store),
      date = store.today();
    store.mark(h.id, date, { kind: "increment", delta: 2.5 });
    const snapshot = journalWidgetSnapshot(store);
    expect(snapshot.days[0]!.habits[0]).toMatchObject({ value: 2.5, revision: 1, done: false });
    expect(snapshot.days[1]!.habits[0]).toMatchObject({ value: 0, revision: 0, done: false });
    const change = {
      operationId: randomUUID(),
      habitId: h.id,
      localDate: date,
      baseRevision: 1,
      dependsOn: store.outbox().at(-1)!.id,
      action: { kind: "set" as const, status: "done" as const, value: 8 },
    };
    store.mark(h.id, date, { kind: "increment", delta: 1 });
    store.ensureProfile("second-profile");
    store.activateProfile("second-profile");
    expect(store.importWidgetOperation("guest", change)).toBe(true);
    expect(store.importWidgetOperation("guest", change)).toBe(true);
    expect(store.profileId).toBe("second-profile");
    expect(store.snapshot().entries).toEqual([]);
    store.activateProfile("guest");
    expect(store.snapshot().entries[0]).toMatchObject({ value: 3.5, revision: 2 });
    expect(store.outbox().filter((item) => item.id === change.operationId)).toHaveLength(0);
    expect(store.widgetReviews()).toHaveLength(1);
    expect(store.widgetReviews()[0]?.operations).toEqual([change]);
    store.resolveWidgetReview(change.operationId, true);
    expect(store.widgetReviews()).toHaveLength(0);
    expect(store.snapshot().entries[0]).toMatchObject({ value: 8, revision: 3 });
    expect(store.conflictHistory()[0]).toMatchObject({
      choice: "widget",
      review: { current: { value: 3.5 }, intended: { value: 8 } },
    });
    expect(store.importWidgetOperation("unknown-profile", change)).toBe(false);
  });
  it("does not acknowledge a widget action if its SQLite outbox cannot commit", () => {
    const { db, store } = open();
    const h = habit(store);
    const change = {
      operationId: randomUUID(),
      habitId: h.id,
      localDate: store.today(),
      baseRevision: 0,
      action: { kind: "set" as const, status: "done" as const },
    };
    db.exec(
      "CREATE TRIGGER fail_widget BEFORE INSERT ON outbox BEGIN SELECT RAISE(ABORT, 'disk full'); END;",
    );
    expect(() => store.importWidgetOperation("guest", change)).toThrow();
    expect(store.snapshot().entries).toHaveLength(0);
    db.exec("DROP TRIGGER fail_widget");
    expect(store.importWidgetOperation("guest", change)).toBe(true);
    expect(store.snapshot().entries[0]?.value).toBe(8);
    expect(store.importWidgetOperation("guest", change)).toBe(true);
    expect(store.snapshot().entries[0]?.revision).toBe(1);
  });
  it("rejects a goal that PostgreSQL would silently round", () => {
    const { store } = open();
    expect(() =>
      store.createHabit({
        title: "Water",
        type: "counter",
        targetValue: 0.1234,
        unit: "l",
        time: "morning",
        icon: "water",
        schedule: { kind: "daily" },
      }),
    ).toThrow("INVALID_TARGET");
    expect(store.snapshot().habits).toHaveLength(0);
    expect(store.outbox()).toHaveLength(0);
  });
  it("keeps a guest habit, partial count and outbox after closing and reopening the database", () => {
    const directory = mkdtempSync(join(tmpdir(), "ownday-sqlite-"));
    directories.push(directory);
    const path = join(directory, "ownday.db");
    const first = open(path);
    const h = habit(first.store);
    first.store.mark(h.id, first.store.today(), { kind: "increment", delta: 2.5 });
    first.db.close();
    databases.splice(databases.indexOf(first.db), 1);
    const second = open(path).store;
    expect(second.snapshot().habits[0]?.id).toBe(h.id);
    expect(second.snapshot().entries[0]).toMatchObject({ value: 2.5, status: "miss" });
    expect(second.outbox()).toHaveLength(2);
  });
  it("rolls back the visible value if saving the outbox fails", () => {
    const { db, store } = open();
    const h = habit(store);
    db.exec(
      "CREATE TRIGGER fail_outbox BEFORE INSERT ON outbox BEGIN SELECT RAISE(ABORT, 'disk write failed'); END;",
    );
    expect(() => store.mark(h.id, store.today(), { kind: "increment", delta: 1 })).toThrow();
    expect(store.snapshot().entries).toEqual([]);
    expect(store.outbox()).toHaveLength(1);
  });
  it("isolates accounts and keeps guest data when changing active profiles", () => {
    const { store } = open();
    const h = habit(store);
    store.ensureProfile("account-one");
    store.activateProfile("account-one");
    expect(store.snapshot().habits).toEqual([]);
    expect(store.outbox()).toEqual([]);
    expect(() => store.mark(h.id, store.today(), { kind: "set", status: "done" })).toThrow();
    store.activateProfile("guest");
    expect(store.snapshot().habits[0]?.id).toBe(h.id);
  });
  it("restores partial progress after skip and retains history when archived", () => {
    const { store } = open();
    const h = habit(store);
    const date = store.today();
    store.mark(h.id, date, { kind: "increment", delta: 3 });
    store.mark(h.id, date, { kind: "skip" });
    store.mark(h.id, date, { kind: "unskip" });
    expect(store.snapshot().entries[0]?.value).toBe(3);
    store.archiveHabit(h.id, true);
    expect(store.snapshot().entries[0]?.value).toBe(3);
    expect(() => store.mark(h.id, date, { kind: "increment", delta: 1 })).toThrow();
    store.archiveHabit(h.id, false);
    store.mark(h.id, date, { kind: "increment", delta: 1 });
    expect(store.snapshot().entries[0]?.value).toBe(4);
  });
});
