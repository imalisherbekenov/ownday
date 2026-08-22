import { randomUUID } from "node:crypto";
import type {
  HabitRepository,
  EntryRepository,
  ReminderRepository,
  UserRepository,
} from "./repositories.js";
import type {
  CreateHabitInput,
  Habit,
  HabitEntry,
  HabitReminder,
  HabitStats,
  Identity,
  UpdateHabitInput,
  User,
} from "./types.js";

export class InMemoryHabitRepository implements HabitRepository {
  habits = new Map<string, Habit>();
  stats = new Map<string, HabitStats>();
  async create(i: CreateHabitInput) {
    const now = new Date(),
      id = randomUUID();
    const h: Habit = {
      id,
      userId: i.userId,
      title: i.title,
      type: i.type,
      icon: i.icon ?? "check",
      color: i.color ?? "moss",
      category: i.category ?? "general",
      targetValue: i.targetValue ?? null,
      unit: i.unit ?? null,
      sortOrder: i.sortOrder ?? this.habits.size,
      archivedAt: null,
      createdAt: now,
      scheduleVersions: [{ schedule: i.schedule, validFrom: i.validFrom }],
    };
    this.habits.set(id, h);
    return structuredClone(h);
  }
  async update(id: string, userId: string, i: UpdateHabitInput) {
    const h = this.habits.get(id);
    if (!h || h.userId !== userId) return null;
    Object.assign(h, i);
    if (i.schedule)
      h.scheduleVersions.push({
        schedule: i.schedule,
        validFrom: i.validFrom ?? new Date().toISOString().slice(0, 10),
      });
    return structuredClone(h);
  }
  async findById(id: string) {
    const h = this.habits.get(id);
    return h ? structuredClone(h) : null;
  }
  async listByUser(userId: string, includeArchived = false) {
    return [...this.habits.values()]
      .filter((h) => h.userId === userId && (includeArchived || !h.archivedAt))
      .sort((a, b) => a.sortOrder - b.sortOrder)
      .map((h) => structuredClone(h));
  }
  async archive(id: string, userId: string, at: Date) {
    const h = this.habits.get(id);
    if (!h || h.userId !== userId) return false;
    h.archivedAt = at;
    return true;
  }
  async reorder(userId: string, ids: string[]) {
    ids.forEach((id, n) => {
      const h = this.habits.get(id);
      if (h?.userId === userId) h.sortOrder = n;
    });
  }
  async writeStats(s: HabitStats) {
    this.stats.set(s.habitId, structuredClone(s));
  }
}
export class InMemoryEntryRepository implements EntryRepository {
  entries = new Map<string, HabitEntry>();
  async findByClientId(c: string) {
    return structuredClone([...this.entries.values()].find((e) => e.clientId === c) ?? null);
  }
  async upsert(i: Parameters<EntryRepository["upsert"]>[0]) {
    const byClient = [...this.entries.values()].find((e) => e.clientId === i.clientId);
    if (byClient) return structuredClone(byClient);
    const key = `${i.habitId}:${i.localDate}`,
      old = this.entries.get(key),
      now = new Date();
    const e: HabitEntry = {
      id: old?.id ?? randomUUID(),
      createdAt: old?.createdAt ?? now,
      updatedAt: now,
      ...i,
    };
    this.entries.set(key, e);
    return structuredClone(e);
  }
  async setValue(i: Parameters<EntryRepository["setValue"]>[0]) {
    const key = `${i.habitId}:${i.localDate}`,
      old = this.entries.get(key),
      now = new Date();
    const e: HabitEntry = {
      id: old?.id ?? randomUUID(),
      createdAt: old?.createdAt ?? now,
      updatedAt: now,
      ...i,
      clientId: old?.clientId ?? randomUUID(),
    };
    this.entries.set(key, e);
    return structuredClone(e);
  }
  async delete(h: string, d: string, u: string) {
    const key = `${h}:${d}`,
      e = this.entries.get(key);
    return !!e && e.userId === u && this.entries.delete(key);
  }
  async listForHabit(h: string, t?: string) {
    return [...this.entries.values()]
      .filter((e) => e.habitId === h && (!t || e.localDate <= t))
      .map((e) => structuredClone(e));
  }
  async listForUser(u: string, f: string, t: string) {
    return [...this.entries.values()]
      .filter((e) => e.userId === u && e.localDate >= f && e.localDate <= t)
      .map((e) => structuredClone(e));
  }
}
export class InMemoryUserRepository implements UserRepository {
  users = new Map<string, User>();
  identities: Identity[] = [];
  async findById(id: string) {
    return structuredClone(this.users.get(id) ?? null);
  }
  async findIdentity(p: Identity["provider"], e: string) {
    const i = this.identities.find((x) => x.provider === p && x.externalId === e),
      u = i && this.users.get(i.userId);
    return i && u ? { identity: structuredClone(i), user: structuredClone(u) } : null;
  }
  async findIdentityForUser(userId: string, p: Identity["provider"]) {
    return structuredClone(
      this.identities.find((x) => x.userId === userId && x.provider === p) ?? null,
    );
  }
  async createWithIdentity(i: Parameters<UserRepository["createWithIdentity"]>[0]) {
    const found = await this.findIdentity(i.provider, i.externalId);
    if (found) return found.user;
    const id = randomUUID(),
      u: User = {
        id,
        timezone: i.timezone,
        dayStartHour: i.dayStartHour,
        locale: i.locale,
        createdAt: new Date(),
      };
    this.users.set(id, u);
    this.identities.push({
      id: randomUUID(),
      userId: id,
      provider: i.provider,
      externalId: i.externalId,
    });
    return structuredClone(u);
  }
  async update(id: string, i: Partial<Pick<User, "timezone" | "dayStartHour" | "locale">>) {
    const u = this.users.get(id);
    if (!u) return null;
    Object.assign(u, i);
    return structuredClone(u);
  }
}
export class InMemoryReminderRepository implements ReminderRepository {
  reminders = new Map<string, HabitReminder>();
  async findById(id: string) {
    return structuredClone(this.reminders.get(id) ?? null);
  }
  async due(now: Date, l: number) {
    return [...this.reminders.values()]
      .filter((r) => r.enabled && r.nextFireAt <= now)
      .sort((a, b) => +a.nextFireAt - +b.nextFireAt)
      .slice(0, l)
      .map((r) => structuredClone(r));
  }
  async updateNextFireAt(id: string, at: Date) {
    const r = this.reminders.get(id);
    if (!r) return null;
    r.nextFireAt = at;
    return structuredClone(r);
  }
  async create(i: Omit<HabitReminder, "id">) {
    const r = { id: randomUUID(), ...i };
    this.reminders.set(r.id, r);
    return structuredClone(r);
  }
  async listByUser(u: string) {
    return [...this.reminders.values()]
      .filter((r) => r.userId === u)
      .map((r) => structuredClone(r));
  }
}
