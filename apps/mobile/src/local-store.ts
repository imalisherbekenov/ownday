import {
  assertLocalDate,
  assertEntryOperation,
  isDue,
  localDateFor,
  scheduleAt,
  transitionEntry,
  validateSchedule,
  validateHabitFields,
  sameSchedule,
  syncEntity,
  assertSyncOperation,
} from "@ownday/core";
import type {
  EntryAction,
  EntryOperation,
  EntryValue,
  Schedule,
  ScheduleVersion,
  HabitSnapshot,
  EntrySnapshot,
  SyncOperation,
  SyncResult,
  SyncSnapshot,
} from "@ownday/core";

export type LocalHabit = HabitSnapshot;
export type LocalEntry = EntrySnapshot;
export type Preferences = {
  locale: "ru" | "en";
  theme: "system" | "light" | "dark";
  timezone: string;
  dayStartHour: number;
  reminders?: Record<string, string>;
};
export type LocalSnapshot = {
  profileId: string;
  preferences: Preferences;
  habits: LocalHabit[];
  entries: LocalEntry[];
  pending: number;
  conflicts: number;
};
export type OutboxItem = {
  id: string;
  kind: "habit" | "entry";
  payload: string;
  status: "pending" | "conflict";
  result: string | null;
};
export type WidgetReview = {
  id: string;
  operations: EntryOperation[];
  current: LocalEntry | null;
  intended: LocalEntry;
};
export interface LocalDatabase {
  execSync(sql: string): void;
  runSync(sql: string, ...params: Array<string | number | null>): unknown;
  getFirstSync<T>(sql: string, ...params: Array<string | number | null>): T | null;
  getAllSync<T>(sql: string, ...params: Array<string | number | null>): T[];
}
export const habitActiveOn = (habit: LocalHabit, date: string) =>
  date >= habit.startedOn &&
  !habit.inactiveRanges.some(
    (range) => date >= range.from && (range.through === null || date < range.through),
  );

/** All writes, including outbox writes, commit synchronously in one SQLite transaction. */
export class LocalStore {
  constructor(
    private db: LocalDatabase,
    private uuid: () => string,
    private clock: () => Date = () => new Date(),
  ) {
    const version =
      db.getFirstSync<{ user_version: number }>("PRAGMA user_version")?.user_version ?? 0;
    if (version > 5) throw new Error("DATABASE_VERSION_TOO_NEW");
    db.execSync(`PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;
      CREATE TABLE IF NOT EXISTS profiles (id TEXT PRIMARY KEY, preferences TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS meta (key TEXT PRIMARY KEY, value TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS habits (profileId TEXT NOT NULL, id TEXT NOT NULL, payload TEXT NOT NULL,
        PRIMARY KEY(profileId,id), FOREIGN KEY(profileId) REFERENCES profiles(id));
      CREATE TABLE IF NOT EXISTS entries (profileId TEXT NOT NULL, habitId TEXT NOT NULL, localDate TEXT NOT NULL, payload TEXT NOT NULL,
        PRIMARY KEY(profileId,habitId,localDate), FOREIGN KEY(profileId,habitId) REFERENCES habits(profileId,id));
      CREATE TABLE IF NOT EXISTS outbox (sequence INTEGER PRIMARY KEY AUTOINCREMENT, profileId TEXT NOT NULL, id TEXT NOT NULL,
        kind TEXT NOT NULL, payload TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'pending', result TEXT,
        UNIQUE(profileId,id), FOREIGN KEY(profileId) REFERENCES profiles(id));
      CREATE TABLE IF NOT EXISTS confirmed (profileId TEXT NOT NULL, entity TEXT NOT NULL, payload TEXT NOT NULL,
        PRIMARY KEY(profileId,entity), FOREIGN KEY(profileId) REFERENCES profiles(id));
      CREATE TABLE IF NOT EXISTS conflict_history (profileId TEXT NOT NULL, id TEXT NOT NULL, payload TEXT NOT NULL,
        PRIMARY KEY(profileId,id), FOREIGN KEY(profileId) REFERENCES profiles(id));
      CREATE TABLE IF NOT EXISTS legacy_sources (source TEXT PRIMARY KEY, payload TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS legacy_reviewed (profileId TEXT NOT NULL, sourceKey TEXT NOT NULL, PRIMARY KEY(profileId,sourceKey));
      CREATE TABLE IF NOT EXISTS widget_receipts (profileId TEXT NOT NULL, operationId TEXT NOT NULL, PRIMARY KEY(profileId,operationId));
      CREATE TABLE IF NOT EXISTS widget_reviews (profileId TEXT NOT NULL, id TEXT NOT NULL, payload TEXT NOT NULL, PRIMARY KEY(profileId,id));
      PRAGMA user_version = 5;`);
    this.ensureProfile("guest");
    db.runSync(
      "INSERT INTO meta(key,value) VALUES('activeProfile','guest') ON CONFLICT(key) DO NOTHING",
    );
  }
  private transaction<T>(fn: () => T): T {
    this.db.execSync("BEGIN IMMEDIATE");
    try {
      const result = fn();
      this.db.execSync("COMMIT");
      return result;
    } catch (error) {
      this.db.execSync("ROLLBACK");
      throw error;
    }
  }
  get profileId() {
    return this.db.getFirstSync<{ value: string }>(
      "SELECT value FROM meta WHERE key='activeProfile'",
    )!.value;
  }
  ensureProfile(id: string, preferences?: Preferences) {
    const defaults: Preferences = {
      locale: "ru",
      theme: "system",
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC",
      dayStartHour: 4,
    };
    this.db.runSync(
      "INSERT INTO profiles(id,preferences) VALUES(?,?) ON CONFLICT(id) DO NOTHING",
      id,
      JSON.stringify(preferences ?? defaults),
    );
  }
  activateProfile(id: string) {
    if (!this.db.getFirstSync("SELECT id FROM profiles WHERE id=?", id))
      throw new Error("PROFILE_NOT_FOUND");
    this.db.runSync("UPDATE meta SET value=? WHERE key='activeProfile'", id);
  }
  activateGuest() {
    const saved = this.db.getFirstSync<{ value: string }>(
      "SELECT value FROM meta WHERE key='guestProfile'",
    );
    this.activateProfile(saved?.value ?? "guest");
  }
  forgetAccount(userId: string) {
    const account = `account:${userId}`;
    if (this.profileId !== account) throw new Error("PROFILE_CHANGED");
    this.transaction(() => {
      const transferred = this.db
        .getAllSync<{
          key: string;
        }>("SELECT key FROM meta WHERE key LIKE 'transferred:%' AND value=?", account)
        .map((row) => row.key.slice("transferred:".length));
      const profiles = [account, ...transferred];
      const guest = `guest:${this.uuid()}`;
      const { reminders: _removed, ...preferences } = this.snapshot().preferences;
      this.ensureProfile(guest, preferences);
      this.db.runSync(
        "INSERT INTO meta(key,value) VALUES('guestProfile',?) ON CONFLICT(key) DO UPDATE SET value=excluded.value",
        guest,
      );
      this.activateProfile(guest);
      for (const profile of profiles) {
        for (const table of [
          "outbox",
          "confirmed",
          "conflict_history",
          "legacy_reviewed",
          "widget_receipts",
          "widget_reviews",
          "entries",
          "habits",
        ])
          this.db.runSync(`DELETE FROM ${table} WHERE profileId=?`, profile);
        this.db.runSync("DELETE FROM profiles WHERE id=?", profile);
        this.db.runSync(
          "INSERT INTO meta(key,value) VALUES(?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value",
          `deletedProfile:${profile}`,
          "1",
        );
      }
    });
  }
  /** Transfer is local and atomic. Retain the source profile as a backup, then use a fresh guest on logout. */
  attachAccount(snapshot: SyncSnapshot, includeGuest: boolean) {
    const source = this.profileId,
      profile = `account:${snapshot.userId}`;
    if (includeGuest && !source.startsWith("guest")) throw new Error("GUEST_PROFILE_REQUIRED");
    this.transaction(() => {
      const preferences = { ...this.snapshot().preferences, ...snapshot.preferences };
      this.ensureProfile(profile, preferences);
      const accountPreferences = JSON.parse(
        this.db.getFirstSync<{ preferences: string }>(
          "SELECT preferences FROM profiles WHERE id=?",
          profile,
        )!.preferences,
      ) as Preferences;
      this.db.runSync(
        "UPDATE profiles SET preferences=? WHERE id=?",
        JSON.stringify({
          ...accountPreferences,
          timezone: snapshot.preferences.timezone,
          dayStartHour: snapshot.preferences.dayStartHour,
          ...(includeGuest
            ? { reminders: { ...accountPreferences.reminders, ...preferences.reminders } }
            : {}),
        }),
        profile,
      );
      if (includeGuest) {
        const claim = this.db.getFirstSync<{ value: string }>(
          "SELECT value FROM meta WHERE key=?",
          `transferred:${source}`,
        );
        if (claim) throw new Error("GUEST_ALREADY_TRANSFERRED");
        this.db.runSync(
          "INSERT INTO widget_reviews(profileId,id,payload) SELECT ?,id,payload FROM widget_reviews WHERE profileId=?",
          profile,
          source,
        );
        this.db.runSync(
          "INSERT INTO widget_receipts(profileId,operationId) SELECT ?,operationId FROM widget_receipts WHERE profileId=?",
          profile,
          source,
        );
        for (const item of this.outbox(source))
          this.db.runSync(
            "INSERT INTO outbox(profileId,id,kind,payload,status,result) VALUES(?,?,?,?,?,?)",
            profile,
            item.id,
            item.kind,
            item.payload,
            item.status,
            item.result,
          );
        this.db.runSync(
          "INSERT INTO meta(key,value) VALUES(?,?)",
          `transferred:${source}`,
          profile,
        );
        const guest = `guest:${this.uuid()}`;
        const { reminders: _transferredReminders, ...guestPreferences } = preferences;
        this.ensureProfile(guest, guestPreferences);
        this.db.runSync(
          "INSERT INTO meta(key,value) VALUES('guestProfile',?) ON CONFLICT(key) DO UPDATE SET value=excluded.value",
          guest,
        );
      }
      this.activateProfile(profile);
      this.db.runSync("DELETE FROM confirmed WHERE profileId=?", profile);
      for (const habit of snapshot.habits) this.confirm(`habit:${habit.id}`, habit);
      for (const entry of snapshot.entries)
        this.confirm(`entry:${entry.habitId}:${entry.localDate}`, entry);
      this.rebuild();
    });
  }
  snapshot(): LocalSnapshot {
    const id = this.profileId;
    return {
      profileId: id,
      preferences: JSON.parse(
        this.db.getFirstSync<{ preferences: string }>(
          "SELECT preferences FROM profiles WHERE id=?",
          id,
        )!.preferences,
      ),
      habits: this.db
        .getAllSync<{ payload: string }>("SELECT payload FROM habits WHERE profileId=?", id)
        .map((row) => JSON.parse(row.payload) as LocalHabit)
        .sort((a, b) => a.sortOrder - b.sortOrder),
      entries: this.db
        .getAllSync<{ payload: string }>("SELECT payload FROM entries WHERE profileId=?", id)
        .map((row) => JSON.parse(row.payload) as LocalEntry),
      pending: this.db.getFirstSync<{ count: number }>(
        "SELECT count(*) AS count FROM outbox WHERE profileId=? AND status='pending'",
        id,
      )!.count,
      conflicts: this.db.getFirstSync<{ count: number }>(
        "SELECT count(*) AS count FROM outbox WHERE profileId=? AND status='conflict'",
        id,
      )!.count,
    };
  }
  today() {
    const p = this.snapshot().preferences;
    return localDateFor(this.clock(), p.timezone, p.dayStartHour);
  }
  private saveHabit(habit: LocalHabit) {
    this.db.runSync(
      "INSERT INTO habits(profileId,id,payload) VALUES(?,?,?) ON CONFLICT(profileId,id) DO UPDATE SET payload=excluded.payload",
      this.profileId,
      habit.id,
      JSON.stringify(habit),
    );
  }
  private enqueue(kind: "habit" | "entry", payload: unknown, id = this.uuid()) {
    const operation = {
      kind,
      change: { ...(payload as object), operationId: id },
    } as SyncOperation;
    const previous = this.outbox()
      .map((item) => this.operation(item))
      .reverse()
      .find((item) => syncEntity(item) === syncEntity(operation));
    if (previous) operation.change.dependsOn = previous.change.operationId;
    assertSyncOperation(operation);
    const conflict = this.outbox().find(
      (item) =>
        item.status === "conflict" && syncEntity(this.operation(item)) === syncEntity(operation),
    );
    if (conflict)
      this.db.runSync(
        "UPDATE outbox SET result=? WHERE profileId=? AND id=?",
        JSON.stringify({
          ...JSON.parse(conflict.result!),
          localVersion: this.visibleVersion(operation),
        }),
        this.profileId,
        conflict.id,
      );
    this.db.runSync(
      "INSERT INTO outbox(profileId,id,kind,payload) VALUES(?,?,?,?)",
      this.profileId,
      id,
      kind,
      JSON.stringify(operation.change),
    );
  }
  createHabit(
    input: Pick<LocalHabit, "title" | "type" | "targetValue" | "unit" | "time" | "icon"> & {
      schedule: Schedule;
    },
  ) {
    validateHabitFields(input);
    validateSchedule(input.schedule);
    const today = this.today();
    const habit: LocalHabit = {
      id: this.uuid(),
      title: input.title.trim(),
      type: input.type,
      targetValue: input.targetValue,
      unit: input.unit.trim(),
      time: input.time,
      icon: input.icon,
      startedOn: today,
      scheduleVersions: [{ validFrom: today, schedule: input.schedule }],
      sortOrder: this.snapshot().habits.length,
      archivedOn: null,
      inactiveRanges: [],
      revision: 1,
      createdAt: this.clock().toISOString(),
    };
    this.transaction(() => {
      this.saveHabit(habit);
      this.enqueue("habit", { habit, baseRevision: 0 });
    });
    return habit;
  }
  editHabit(
    id: string,
    input: Pick<LocalHabit, "title" | "targetValue" | "unit" | "time" | "icon"> & {
      schedule: Schedule;
    },
  ) {
    validateHabitFields(input);
    validateSchedule(input.schedule);
    return this.transaction(() => {
      const habit = this.snapshot().habits.find((h) => h.id === id);
      if (!habit) throw new Error("HABIT_NOT_FOUND");
      const today = this.today();
      const changed = !sameSchedule(scheduleAt(habit.scheduleVersions, today), input.schedule);
      const versions = changed
        ? [
            ...habit.scheduleVersions.filter((v) => v.validFrom !== today),
            { validFrom: today, schedule: input.schedule },
          ]
        : habit.scheduleVersions;
      const next = {
        ...habit,
        title: input.title.trim(),
        targetValue: input.targetValue,
        unit: input.unit.trim(),
        time: input.time,
        icon: input.icon,
        scheduleVersions: versions,
        revision: habit.revision + 1,
      };
      this.saveHabit(next);
      this.enqueue("habit", { habit: next, baseRevision: habit.revision });
      return next;
    });
  }
  archiveHabit(id: string, archive: boolean) {
    this.transaction(() => {
      const habit = this.snapshot().habits.find((h) => h.id === id);
      if (!habit) throw new Error("HABIT_NOT_FOUND");
      if (Boolean(habit.archivedOn) === archive) return;
      const today = this.today();
      const next = {
        ...habit,
        archivedOn: archive ? today : null,
        revision: habit.revision + 1,
        inactiveRanges: archive
          ? [...habit.inactiveRanges, { from: today, through: null }]
          : habit.inactiveRanges.map((range) =>
              range.through === null ? { ...range, through: today } : range,
            ),
      };
      this.saveHabit(next);
      this.enqueue("habit", { habit: next, baseRevision: habit.revision });
    });
  }
  reorder(ids: string[]) {
    this.transaction(() => {
      const habits = this.snapshot().habits;
      if (new Set(ids).size !== ids.length || ids.some((id) => !habits.some((h) => h.id === id)))
        throw new Error("INVALID_ORDER");
      ids.forEach((id, sortOrder) => {
        const habit = habits.find((h) => h.id === id)!;
        const next = { ...habit, sortOrder, revision: habit.revision + 1 };
        this.saveHabit(next);
        this.enqueue("habit", { habit: next, baseRevision: habit.revision });
      });
    });
  }
  mark(habitId: string, localDate: string, action: EntryAction) {
    assertLocalDate(localDate);
    return this.transaction(() => {
      const snapshot = this.snapshot();
      const habit = snapshot.habits.find((h) => h.id === habitId);
      if (
        !habit ||
        !habitActiveOn(habit, localDate) ||
        !isDue(scheduleAt(habit.scheduleVersions, localDate), localDate)
      )
        throw new Error("HABIT_NOT_DUE");
      if (localDate > this.today()) throw new Error("FUTURE_ENTRY");
      const current =
        snapshot.entries.find((e) => e.habitId === habitId && e.localDate === localDate) ?? null;
      const operation: EntryOperation = {
        operationId: this.uuid(),
        habitId,
        localDate,
        baseRevision: current?.revision ?? 0,
        action,
      };
      const state = transitionEntry(current, operation, habit);
      if (!state) throw new Error("LOCAL_CONFLICT");
      const entry: LocalEntry = { ...state, id: current?.id ?? this.uuid(), habitId, localDate };
      this.db.runSync(
        "INSERT INTO entries(profileId,habitId,localDate,payload) VALUES(?,?,?,?) ON CONFLICT(profileId,habitId,localDate) DO UPDATE SET payload=excluded.payload",
        this.profileId,
        habitId,
        localDate,
        JSON.stringify(entry),
      );
      this.enqueue("entry", operation, operation.operationId);
      return entry;
    });
  }
  /** The native queue is acknowledged only after this transaction commits. */
  importWidgetOperation(profileId: string, operation: EntryOperation) {
    if (this.db.getFirstSync("SELECT value FROM meta WHERE key=?", `deletedProfile:${profileId}`))
      return true;
    assertEntryOperation(operation);
    profileId =
      this.db.getFirstSync<{ value: string }>(
        "SELECT value FROM meta WHERE key=?",
        `transferred:${profileId}`,
      )?.value ?? profileId;
    if (!this.db.getFirstSync("SELECT id FROM profiles WHERE id=?", profileId)) return false;
    return this.transaction(() => {
      const active = this.profileId;
      this.activateProfile(profileId);
      try {
        if (
          this.db.getFirstSync(
            "SELECT operationId FROM widget_receipts WHERE profileId=? AND operationId=?",
            profileId,
            operation.operationId,
          )
        )
          return true;
        if (!this.outbox().some((item) => item.id === operation.operationId)) {
          const snapshot = this.snapshot();
          const habit = snapshot.habits.find((item) => item.id === operation.habitId);
          if (!habit || operation.localDate < habit.startedOn || operation.localDate > this.today())
            return false;
          const current =
            snapshot.entries.find(
              (item) =>
                item.habitId === operation.habitId && item.localDate === operation.localDate,
            ) ?? null;
          const review = this.widgetReviews().find(
            (item) =>
              item.intended.habitId === operation.habitId &&
              item.intended.localDate === operation.localDate,
          );
          const state = transitionEntry(
            current,
            { ...operation, baseRevision: current?.revision ?? 0 },
            habit,
          );
          if (!state) throw new Error("INVALID_WIDGET_OPERATION");
          const entry = {
            ...state,
            id: current?.id ?? this.uuid(),
            habitId: habit.id,
            localDate: operation.localDate,
          };
          if (
            review ||
            operation.baseRevision !== (current?.revision ?? 0) ||
            !habitActiveOn(habit, operation.localDate) ||
            !isDue(scheduleAt(habit.scheduleVersions, operation.localDate), operation.localDate)
          ) {
            const next: WidgetReview = {
              id: review?.id ?? operation.operationId,
              operations: [...(review?.operations ?? []), operation],
              current: review?.current ?? current,
              intended: entry,
            };
            this.db.runSync(
              "INSERT INTO widget_reviews(profileId,id,payload) VALUES(?,?,?) ON CONFLICT(profileId,id) DO UPDATE SET payload=excluded.payload",
              profileId,
              next.id,
              JSON.stringify(next),
            );
            this.db.runSync(
              "INSERT INTO widget_receipts(profileId,operationId) VALUES(?,?)",
              profileId,
              operation.operationId,
            );
            return true;
          }
          this.db.runSync(
            "INSERT INTO entries(profileId,habitId,localDate,payload) VALUES(?,?,?,?) ON CONFLICT(profileId,habitId,localDate) DO UPDATE SET payload=excluded.payload",
            profileId,
            habit.id,
            operation.localDate,
            JSON.stringify(entry),
          );
          // Keep the captured revision and dependency: rebasing would hide an offline conflict.
          this.db.runSync(
            "INSERT INTO outbox(profileId,id,kind,payload) VALUES(?,?,'entry',?)",
            profileId,
            operation.operationId,
            JSON.stringify(operation),
          );
          const entity = syncEntity({ kind: "entry", change: operation });
          const conflict = this.outbox().find(
            (item) => item.status === "conflict" && syncEntity(this.operation(item)) === entity,
          );
          if (conflict)
            this.db.runSync(
              "UPDATE outbox SET result=? WHERE profileId=? AND id=?",
              JSON.stringify({ ...JSON.parse(conflict.result!), localVersion: entry }),
              profileId,
              conflict.id,
            );
        }
        this.db.runSync(
          "INSERT INTO widget_receipts(profileId,operationId) VALUES(?,?)",
          profileId,
          operation.operationId,
        );
        return true;
      } finally {
        this.activateProfile(active);
      }
    });
  }
  widgetReviews(): WidgetReview[] {
    return this.db
      .getAllSync<{
        payload: string;
      }>("SELECT payload FROM widget_reviews WHERE profileId=?", this.profileId)
      .map((row) => JSON.parse(row.payload));
  }
  resolveWidgetReview(id: string, useWidget: boolean) {
    this.transaction(() => {
      const review = this.widgetReviews().find((item) => item.id === id);
      if (!review) return;
      const snapshot = this.snapshot(),
        intended = review.intended;
      const habit = snapshot.habits.find((item) => item.id === intended.habitId);
      const current =
        snapshot.entries.find(
          (item) => item.habitId === intended.habitId && item.localDate === intended.localDate,
        ) ?? null;
      if (useWidget) {
        if (
          !habit ||
          !habitActiveOn(habit, intended.localDate) ||
          !isDue(scheduleAt(habit.scheduleVersions, intended.localDate), intended.localDate)
        )
          throw new Error("HABIT_NOT_DUE");
        const operation: EntryOperation = {
          operationId: this.uuid(),
          habitId: intended.habitId,
          localDate: intended.localDate,
          baseRevision: current?.revision ?? 0,
          action: intended.deleted
            ? { kind: "clear" }
            : { kind: "set", status: intended.status, value: intended.value },
        };
        const state = transitionEntry(current, operation, habit)!;
        this.db.runSync(
          "INSERT INTO entries(profileId,habitId,localDate,payload) VALUES(?,?,?,?) ON CONFLICT(profileId,habitId,localDate) DO UPDATE SET payload=excluded.payload",
          this.profileId,
          intended.habitId,
          intended.localDate,
          JSON.stringify({ ...intended, ...state, id: current?.id ?? intended.id }),
        );
        this.enqueue("entry", operation, operation.operationId);
      }
      this.db.runSync(
        "INSERT INTO conflict_history(profileId,id,payload) VALUES(?,?,?)",
        this.profileId,
        this.uuid(),
        JSON.stringify({
          source: "widget",
          review,
          currentAtResolution: current,
          choice: useWidget ? "widget" : "app",
          resolvedAt: this.clock().toISOString(),
        }),
      );
      this.db.runSync("DELETE FROM widget_reviews WHERE profileId=? AND id=?", this.profileId, id);
    });
  }
  savePreferences(next: Partial<Preferences>) {
    if (
      this.profileId.startsWith("account:") &&
      (next.timezone !== undefined || next.dayStartHour !== undefined)
    )
      throw new Error("ACCOUNT_CALENDAR_SETTINGS_REMOTE");
    const preferences = { ...this.snapshot().preferences, ...next };
    localDateFor(this.clock(), preferences.timezone, preferences.dayStartHour);
    if (
      !["ru", "en"].includes(preferences.locale) ||
      !["system", "light", "dark"].includes(preferences.theme)
    )
      throw new Error("INVALID_PREFERENCES");
    this.db.runSync(
      "UPDATE profiles SET preferences=? WHERE id=?",
      JSON.stringify(preferences),
      this.profileId,
    );
  }
  saveReminder(habitId: string, time: string | null) {
    if (!this.snapshot().habits.some((h) => h.id === habitId)) throw new Error("HABIT_NOT_FOUND");
    if (time !== null && !/^([01]\d|2[0-3]):[0-5]\d$/.test(time))
      throw new Error("INVALID_REMINDER_TIME");
    const reminders = { ...this.snapshot().preferences.reminders };
    if (time === null) delete reminders[habitId];
    else reminders[habitId] = time;
    this.savePreferences({ reminders });
  }
  outbox(profileId = this.profileId): OutboxItem[] {
    return this.db.getAllSync(
      "SELECT id,kind,payload,status,result FROM outbox WHERE profileId=? ORDER BY sequence",
      profileId,
    );
  }
  operation(item: OutboxItem): SyncOperation {
    return {
      kind: item.kind,
      change: { ...JSON.parse(item.payload), operationId: item.id },
    } as SyncOperation;
  }
  private visibleVersion(operation: SyncOperation) {
    const snapshot = this.snapshot();
    return operation.kind === "habit"
      ? snapshot.habits.find((h) => h.id === operation.change.habit.id)
      : snapshot.entries.find(
          (e) =>
            e.habitId === operation.change.habitId && e.localDate === operation.change.localDate,
        );
  }
  remoteVersion(item: OutboxItem): LocalHabit | LocalEntry | null {
    const row = this.db.getFirstSync<{ payload: string }>(
      "SELECT payload FROM confirmed WHERE profileId=? AND entity=?",
      this.profileId,
      syncEntity(this.operation(item)),
    );
    return row ? JSON.parse(row.payload) : null;
  }
  private assertAccount(profileId: string) {
    if (!profileId.startsWith("account:") || this.profileId !== profileId)
      throw new Error("PROFILE_CHANGED");
  }
  private confirm(entity: string, payload: LocalHabit | LocalEntry | null) {
    if (payload === null) {
      this.db.runSync(
        "DELETE FROM confirmed WHERE profileId=? AND entity=?",
        this.profileId,
        entity,
      );
      return;
    }
    const previous = this.db.getFirstSync<{ payload: string }>(
      "SELECT payload FROM confirmed WHERE profileId=? AND entity=?",
      this.profileId,
      entity,
    );
    if (previous && JSON.parse(previous.payload).revision > payload.revision) return;
    this.db.runSync(
      "INSERT INTO confirmed(profileId,entity,payload) VALUES(?,?,?) ON CONFLICT(profileId,entity) DO UPDATE SET payload=excluded.payload",
      this.profileId,
      entity,
      JSON.stringify(payload),
    );
  }
  /** Materialize server state plus every unacknowledged local intent. Never rebase outbound revisions here. */
  private rebuild() {
    const previous = this.snapshot();
    const habits = new Map<string, LocalHabit>(),
      entries = new Map<string, LocalEntry>();
    for (const row of this.db.getAllSync<{ entity: string; payload: string }>(
      "SELECT entity,payload FROM confirmed WHERE profileId=?",
      this.profileId,
    )) {
      const payload = JSON.parse(row.payload);
      if (row.entity.startsWith("habit:")) habits.set(payload.id, payload);
      else entries.set(row.entity, payload);
    }
    const pending = this.outbox(),
      conflicted = new Set<string>();
    for (const item of pending.filter((item) => item.status === "conflict")) {
      const operation = this.operation(item),
        entity = syncEntity(operation),
        local = JSON.parse(item.result!).localVersion;
      if (!local) continue;
      conflicted.add(entity);
      if (operation.kind === "habit") habits.set(local.id, local);
      else entries.set(entity, local);
    }
    for (const item of pending) {
      const operation = this.operation(item);
      if (conflicted.has(syncEntity(operation))) continue;
      if (operation.kind === "habit") {
        const habit = operation.change.habit;
        habits.set(habit.id, { ...habit, revision: (habits.get(habit.id)?.revision ?? 0) + 1 });
      } else {
        const change = operation.change,
          habit = habits.get(change.habitId);
        if (!habit) continue;
        const key = syncEntity(operation),
          current = entries.get(key) ?? null;
        const state = transitionEntry(
          current,
          { ...change, baseRevision: current?.revision ?? 0 },
          habit,
        );
        if (!state) throw new Error("INVALID_LOCAL_REPLAY");
        entries.set(key, {
          ...state,
          id:
            current?.id ??
            previous.entries.find(
              (e) => e.habitId === change.habitId && e.localDate === change.localDate,
            )?.id ??
            this.uuid(),
          habitId: change.habitId,
          localDate: change.localDate,
        });
      }
    }
    this.db.runSync("DELETE FROM entries WHERE profileId=?", this.profileId);
    this.db.runSync("DELETE FROM habits WHERE profileId=?", this.profileId);
    for (const habit of habits.values()) this.saveHabit(habit);
    for (const entry of entries.values())
      if (habits.has(entry.habitId))
        this.db.runSync(
          "INSERT INTO entries(profileId,habitId,localDate,payload) VALUES(?,?,?,?)",
          this.profileId,
          entry.habitId,
          entry.localDate,
          JSON.stringify(entry),
        );
  }
  acceptSnapshot(profileId: string, snapshot: SyncSnapshot) {
    this.assertAccount(profileId);
    if (profileId !== `account:${snapshot.userId}`) throw new Error("WRONG_ACCOUNT");
    this.transaction(() => {
      const preferences = {
        ...this.snapshot().preferences,
        timezone: snapshot.preferences.timezone,
        dayStartHour: snapshot.preferences.dayStartHour,
      };
      this.db.runSync(
        "UPDATE profiles SET preferences=? WHERE id=?",
        JSON.stringify(preferences),
        profileId,
      );
      this.db.runSync("DELETE FROM confirmed WHERE profileId=?", profileId);
      for (const habit of snapshot.habits) this.confirm(`habit:${habit.id}`, habit);
      for (const entry of snapshot.entries)
        this.confirm(`entry:${entry.habitId}:${entry.localDate}`, entry);
      this.rebuild();
    });
  }
  acknowledge(profileId: string, result: SyncResult) {
    this.assertAccount(profileId);
    this.transaction(() => {
      const item = this.outbox().find((item) => item.id === result.operationId);
      if (!item) return;
      const operation = this.operation(item),
        entity = syncEntity(operation);
      if (result.kind !== operation.kind) throw new Error("INVALID_ACKNOWLEDGEMENT");
      const payload = result.kind === "habit" ? result.habit : result.entry;
      if (
        payload &&
        (result.kind === "habit"
          ? `habit:${payload.id}`
          : `entry:${(payload as LocalEntry).habitId}:${(payload as LocalEntry).localDate}`) !==
          entity
      )
        throw new Error("INVALID_ACKNOWLEDGEMENT");
      this.confirm(entity, payload);
      if (result.outcome === "applied")
        this.db.runSync("DELETE FROM outbox WHERE profileId=? AND id=?", profileId, item.id);
      else
        this.db.runSync(
          "UPDATE outbox SET status='conflict',result=? WHERE profileId=? AND id=?",
          JSON.stringify({ ...result, localVersion: this.visibleVersion(operation) }),
          profileId,
          item.id,
        );
      this.rebuild();
    });
  }
  /** Keep both versions and the entire dependent chain even after the user makes a choice. */
  resolveConflict(id: string, choice: "local" | "remote") {
    this.transaction(() => {
      const items = this.outbox(),
        item = items.find((item) => item.id === id && item.status === "conflict");
      if (!item) throw new Error("CONFLICT_NOT_FOUND");
      const operation = this.operation(item),
        entity = syncEntity(operation),
        snapshot = this.snapshot();
      const chain = items.filter((item) => syncEntity(this.operation(item)) === entity);
      const confirmed = this.db.getFirstSync<{ payload: string }>(
        "SELECT payload FROM confirmed WHERE profileId=? AND entity=?",
        this.profileId,
        entity,
      );
      const remote = confirmed ? JSON.parse(confirmed.payload) : null;
      const local =
        operation.kind === "habit"
          ? snapshot.habits.find((h) => h.id === operation.change.habit.id)
          : snapshot.entries.find(
              (e) =>
                e.habitId === operation.change.habitId &&
                e.localDate === operation.change.localDate,
            );
      if (choice === "local" && !local) throw new Error("LOCAL_VERSION_NOT_FOUND");
      // A deleted habit needs an explicit new habit, never an implicit resurrection.
      if (choice === "local" && JSON.parse(item.result!).reason === "HABIT_DELETED")
        throw new Error("HABIT_DELETED");
      this.db.runSync(
        "INSERT INTO conflict_history(profileId,id,payload) VALUES(?,?,?)",
        this.profileId,
        this.uuid(),
        JSON.stringify({
          resolvedAt: this.clock().toISOString(),
          choice,
          local,
          remote,
          operations: chain,
        }),
      );
      for (const pending of chain)
        this.db.runSync(
          "DELETE FROM outbox WHERE profileId=? AND id=?",
          this.profileId,
          pending.id,
        );
      if (choice === "local") {
        if (operation.kind === "habit") {
          let habit = local as LocalHabit;
          if (remote && JSON.parse(item.result!).reason === "HISTORICAL_SCHEDULE_IMMUTABLE") {
            const today = this.today();
            habit = {
              ...habit,
              scheduleVersions: [
                ...remote.scheduleVersions.filter(
                  (version: ScheduleVersion) => version.validFrom !== today,
                ),
                { validFrom: today, schedule: scheduleAt(habit.scheduleVersions, today) },
              ].sort((a: ScheduleVersion, b: ScheduleVersion) =>
                a.validFrom.localeCompare(b.validFrom),
              ),
            };
          }
          this.enqueue("habit", { habit, baseRevision: remote?.revision ?? 0 });
        } else {
          const entry = local as LocalEntry;
          this.enqueue("entry", {
            habitId: entry.habitId,
            localDate: entry.localDate,
            baseRevision: remote?.revision ?? 0,
            action: entry.deleted
              ? { kind: "clear" }
              : { kind: "set", status: entry.status, value: entry.value },
          });
        }
      }
      this.rebuild();
    });
  }
  conflictHistory() {
    return this.db
      .getAllSync<{
        payload: string;
      }>("SELECT payload FROM conflict_history WHERE profileId=?", this.profileId)
      .map((row) => JSON.parse(row.payload));
  }
  captureLegacy(sources: ReadonlyArray<readonly [string, string | null]>) {
    this.transaction(() => {
      for (const [source, payload] of sources)
        if (payload !== null)
          this.db.runSync(
            "INSERT INTO legacy_sources(source,payload) VALUES(?,?) ON CONFLICT(source) DO NOTHING",
            source,
            payload,
          );
    });
  }
  hasLegacyData() {
    return Boolean(this.db.getFirstSync("SELECT source FROM legacy_sources LIMIT 1"));
  }
  private legacyQueue(): Array<{
    habitId: string;
    localDate: string;
    status: "done" | "skip" | "miss";
    clientId: string;
  }> {
    const rows = this.db.getAllSync<{ payload: string }>(
      "SELECT payload FROM legacy_sources WHERE source IN ('ownday.mutation-queue.v1','ownday.widget.pending.v1') ORDER BY source",
    );
    return rows.flatMap((row) => {
      try {
        const parsed = JSON.parse(row.payload);
        return Array.isArray(parsed)
          ? parsed.filter(
              (item) =>
                item &&
                typeof item.habitId === "string" &&
                typeof item.localDate === "string" &&
                typeof item.clientId === "string" &&
                ["done", "skip", "miss"].includes(item.status),
            )
          : [];
      } catch {
        return [];
      }
    });
  }
  /** Old actions have no trustworthy base revision. Recover as a visible choice, never an implicit overwrite. */
  importLegacyReviews(remote: SyncSnapshot) {
    this.assertAccount(`account:${remote.userId}`);
    this.transaction(() => {
      for (const item of this.legacyQueue()) {
        const habit = remote.habits.find((h) => h.id === item.habitId),
          key = JSON.stringify(item);
        if (
          !habit ||
          this.db.getFirstSync(
            "SELECT sourceKey FROM legacy_reviewed WHERE profileId=? AND sourceKey=?",
            this.profileId,
            key,
          )
        )
          continue;
        try {
          assertLocalDate(item.localDate);
        } catch {
          continue;
        }
        const entity = `entry:${item.habitId}:${item.localDate}`;
        if (this.outbox().some((item) => syncEntity(this.operation(item)) === entity)) continue;
        const current =
          remote.entries.find(
            (e) => e.habitId === item.habitId && e.localDate === item.localDate,
          ) ?? null;
        const operation: EntryOperation = {
          operationId: this.uuid(),
          habitId: item.habitId,
          localDate: item.localDate,
          baseRevision: current?.revision ?? 0,
          action: { kind: "set", status: item.status },
        };
        const next = transitionEntry(current, operation, habit)!;
        const localVersion = {
          ...next,
          id: current?.id ?? this.uuid(),
          habitId: item.habitId,
          localDate: item.localDate,
        };
        this.enqueue("entry", operation, operation.operationId);
        this.db.runSync(
          "UPDATE outbox SET status='conflict',result=? WHERE profileId=? AND id=?",
          JSON.stringify({
            kind: "entry",
            operationId: operation.operationId,
            outcome: "conflict",
            revision: current?.revision ?? 0,
            entry: current,
            reason: "LEGACY_REVIEW",
            localVersion,
            legacy: item,
          }),
          this.profileId,
          operation.operationId,
        );
        this.db.runSync(
          "INSERT INTO legacy_reviewed(profileId,sourceKey) VALUES(?,?)",
          this.profileId,
          key,
        );
      }
      this.rebuild();
    });
  }
  exportData() {
    return JSON.stringify(
      {
        format: "ownday",
        version: 2,
        exportedAt: this.clock().toISOString(),
        ...this.snapshot(),
        outbox: this.outbox(),
        conflictHistory: this.conflictHistory(),
        widgetReviews: this.widgetReviews(),
        recoveredLegacyActions: this.legacyQueue().filter(
          (item) =>
            this.profileId.startsWith("account:") &&
            this.snapshot().habits.some((h) => h.id === item.habitId),
        ),
      },
      null,
      2,
    );
  }
}
