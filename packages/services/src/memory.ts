import { randomUUID } from "node:crypto";
import { localDateFor } from "@ownday/core";
import { applyEntryChange } from "./entry-operation.js";
import type { EntryOperationResult } from "./repositories.js";
import type {
  HabitRepository,
  EntryRepository,
  ReminderRepository,
  UserRepository,
  TemplateRepository,
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
  HabitTemplate,
} from "./types.js";
import { habitTemplates } from "@ownday/db/templates";

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
    const { schedule, validFrom, ...fields } = i;
    Object.assign(h, fields);
    if (schedule) {
      if (!validFrom) throw new Error("VALID_FROM_REQUIRED");
      h.scheduleVersions.push({
        schedule,
        validFrom,
      });
    }
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
  async archive(id: string, userId: string, at: Date, localDate = localDateFor(at, "UTC", 4)) {
    const h = this.habits.get(id);
    if (!h || h.userId !== userId) return false;
    if (h.archivedAt) return true;
    h.archivedAt = at;
    h.archivedOn = localDate;
    h.inactiveRanges = [...(h.inactiveRanges ?? []), { from: localDate, through: null }];
    return true;
  }
  async restore(
    id: string,
    userId: string,
    at = new Date(),
    localDate = localDateFor(at, "UTC", 4),
  ) {
    const h = this.habits.get(id);
    if (!h || h.userId !== userId) return false;
    h.archivedAt = null;
    h.archivedOn = null;
    h.inactiveRanges = (h.inactiveRanges ?? []).map((range) =>
      range.through === null
        ? { ...range, through: localDate < range.from ? range.from : localDate }
        : range,
    );
    return true;
  }
  async reorder(userId: string, ids: string[]) {
    ids.forEach((id, n) => {
      const h = this.habits.get(id);
      if (h?.userId === userId) h.sortOrder = n;
    });
  }
  async delete(id: string, userId: string, requireArchived = false) {
    const h = this.habits.get(id);
    if (!h || h.userId !== userId || (requireArchived && !h.archivedAt)) return false;
    this.habits.delete(id);
    this.stats.delete(id);
    return true;
  }
  async writeStats(s: HabitStats) {
    this.stats.set(s.habitId, structuredClone(s));
  }
}
export class InMemoryTemplateRepository implements TemplateRepository {
  async list(locale: "ru" | "en") {
    return habitTemplates
      .filter((x) => x.locale === locale)
      .map((x) => structuredClone(x)) as HabitTemplate[];
  }
}
export class InMemoryEntryRepository implements EntryRepository {
  entries = new Map<string, HabitEntry>();
  operations = new Map<
    string,
    { habitId: string; localDate: string; result: EntryOperationResult }
  >();
  async applyOperation(
    input: Parameters<EntryRepository["applyOperation"]>[0],
    context: Parameters<EntryRepository["applyOperation"]>[1],
  ) {
    if (
      context.habit.userId !== input.userId ||
      context.habit.id !== input.habitId ||
      context.user.id !== input.userId
    )
      throw new Error("HABIT_NOT_FOUND");
    const operationKey = `${input.userId}:${input.operationId}`;
    const previous = this.operations.get(operationKey);
    if (previous) {
      if (previous.habitId !== input.habitId || previous.localDate !== input.localDate)
        throw new Error("OPERATION_ID_REUSED");
      return structuredClone(previous.result);
    }
    const key = `${input.habitId}:${input.localDate}`;
    const old = this.entries.get(key) ?? null;
    let effective = input,
      blocked = false;
    if (input.dependsOn) {
      const dependency = this.operations.get(`${input.userId}:${input.dependsOn}`);
      if (
        !dependency ||
        dependency.habitId !== input.habitId ||
        dependency.localDate !== input.localDate
      )
        throw new Error("DEPENDENCY_NOT_FOUND");
      effective = { ...input, baseRevision: dependency.result.revision };
      blocked = dependency.result.outcome === "conflict";
    }
    const conflict = (reason: string) => ({
      next: null,
      result: {
        operationId: input.operationId,
        outcome: "conflict" as const,
        revision: old?.revision ?? 0,
        entry: old && !old.deleted ? old : null,
        state: old,
        reason,
      },
    });
    const transition = () => {
      if (blocked) return conflict("DEPENDENCY_CONFLICT");
      try {
        return applyEntryChange(effective, context.habit, context.user, old, randomUUID());
      } catch (error) {
        if (
          input.conflictOnIneligible &&
          error instanceof Error &&
          ["HABIT_ARCHIVED", "HABIT_NOT_DUE", "ENTRY_DATE_OUT_OF_RANGE"].includes(error.message)
        )
          return conflict(error.message);
        throw error;
      }
    };
    const change =
      old?.clientId === input.operationId
        ? {
            next: null,
            result: {
              operationId: input.operationId,
              outcome: "applied" as const,
              revision: old.revision ?? 0,
              entry: old.deleted ? null : old,
            },
          }
        : transition();
    if (change.next) this.entries.set(key, structuredClone(change.next));
    this.operations.set(operationKey, {
      habitId: input.habitId,
      localDate: input.localDate,
      result: structuredClone(change.result),
    });
    return structuredClone(change.result);
  }
  async deleteByHabit(habitId: string) {
    for (const [key, e] of this.entries) if (e.habitId === habitId) this.entries.delete(key);
    for (const [key, operation] of this.operations)
      if (operation.habitId === habitId) this.operations.delete(key);
  }
  async listForHabit(h: string, t?: string) {
    return [...this.entries.values()]
      .filter((e) => !e.deleted && e.habitId === h && (!t || e.localDate <= t))
      .map((e) => structuredClone(e));
  }
  async listForUser(u: string, f: string, t: string) {
    return [...this.entries.values()]
      .filter((e) => !e.deleted && e.userId === u && e.localDate >= f && e.localDate <= t)
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
  async addIdentity(userId: string, provider: Identity["provider"], externalId: string) {
    const found = await this.findIdentity(provider, externalId);
    if (found) return found.identity;
    if (!this.users.has(userId)) throw new Error("USER_NOT_FOUND");
    const identity = { id: randomUUID(), userId, provider, externalId };
    this.identities.push(identity);
    return structuredClone(identity);
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
  async delete(id: string) {
    this.identities = this.identities.filter((x) => x.userId !== id);
    return this.users.delete(id);
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
  async deleteByHabit(habitId: string) {
    for (const [id, r] of this.reminders) if (r.habitId === habitId) this.reminders.delete(id);
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
