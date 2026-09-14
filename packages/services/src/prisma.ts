import type { PrismaClient, Prisma } from "@ownday/db";
import { randomUUID } from "node:crypto";
import { localDateFor } from "@ownday/core";
import { applyEntryChange } from "./entry-operation.js";
import type { EntryOperationResult } from "./repositories.js";
import type {
  EntryRepository,
  HabitRepository,
  ReminderRepository,
  UserRepository,
  TemplateRepository,
} from "./repositories.js";
import type {
  Habit,
  HabitEntry,
  HabitReminder,
  HabitStats,
  Identity,
  User,
  HabitTemplate,
} from "./types.js";
const d = (s: string) => new Date(`${s}T00:00:00Z`),
  ld = (x: Date) => x.toISOString().slice(0, 10);
const H = (r: any): Habit => ({
    ...r,
    targetValue: r.targetValue === null ? null : Number(r.targetValue),
    archivedOn: r.journalMetadata?.archivedOn ?? null,
    inactiveRanges: r.journalMetadata?.inactiveRanges ?? [],
    scheduleVersions: r.scheduleVersions.map((v: any) => ({
      validFrom: ld(v.validFrom),
      schedule: { kind: v.kind, ...v.config },
    })),
  }),
  E = (r: any): HabitEntry => ({
    ...r,
    localDate: ld(r.localDate),
    ...(r.value === null ? { value: undefined } : { value: Number(r.value) }),
  }),
  R = (r: any): HabitReminder => ({ ...r, localTime: r.localTime.toISOString().slice(11, 19) }),
  U = (r: any): User => ({
    id: r.id,
    timezone: r.timezone,
    dayStartHour: r.dayStartHour,
    locale: r.locale,
    createdAt: r.createdAt,
  });
export class PrismaHabitRepository implements HabitRepository {
  constructor(private p: PrismaClient) {}
  async create(i: Parameters<HabitRepository["create"]>[0]) {
    const data: any = {
      userId: i.userId,
      title: i.title,
      type: i.type,
      icon: i.icon ?? "check",
      color: i.color ?? "moss",
      category: i.category ?? "general",
      sortOrder: i.sortOrder ?? 0,
      scheduleVersions: {
        create: { kind: i.schedule.kind, config: i.schedule, validFrom: d(i.validFrom) },
      },
    };
    if (i.targetValue !== undefined) data.targetValue = i.targetValue;
    if (i.unit !== undefined) data.unit = i.unit;
    return this.p.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT "id" FROM "User" WHERE "id"=${i.userId}::uuid FOR UPDATE`;
      return H(await tx.habit.create({ data, include: { scheduleVersions: true } }));
    });
  }
  async update(id: string, userId: string, i: Parameters<HabitRepository["update"]>[2]) {
    return this.p.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT "id" FROM "User" WHERE "id"=${userId}::uuid FOR UPDATE`;
      if (!(await tx.habit.findFirst({ where: { id, userId } }))) return null;
      const data: any = { ...i, revision: { increment: 1 } };
      delete data.schedule;
      delete data.validFrom;
      if (i.schedule) {
        if (!i.validFrom) throw new Error("VALID_FROM_REQUIRED");
        data.scheduleVersions = {
          upsert: {
            where: { habitId_validFrom: { habitId: id, validFrom: d(i.validFrom) } },
            create: { kind: i.schedule.kind, config: i.schedule, validFrom: d(i.validFrom) },
            update: { kind: i.schedule.kind, config: i.schedule },
          },
        };
      }
      return H(await tx.habit.update({ where: { id }, data, include: { scheduleVersions: true } }));
    });
  }
  async findById(id: string) {
    const r = await this.p.habit.findUnique({ where: { id }, include: { scheduleVersions: true } });
    return r ? H(r) : null;
  }
  async listByUser(userId: string, a = false) {
    return (
      await this.p.habit.findMany({
        where: { userId, ...(a ? {} : { archivedAt: null }) },
        include: { scheduleVersions: true },
        orderBy: { sortOrder: "asc" },
      })
    ).map(H);
  }
  async archive(id: string, userId: string, at: Date) {
    return this.p.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT "id" FROM "User" WHERE "id"=${userId}::uuid FOR UPDATE`;
      const habit = await tx.habit.findFirst({ where: { id, userId } }),
        user = await tx.user.findUnique({ where: { id: userId } });
      if (!habit || !user) return false;
      if (habit.archivedAt) return true;
      const metadata = habit.journalMetadata as Prisma.InputJsonObject,
        ranges = (metadata.inactiveRanges ?? []) as Array<{ from: string; through: string | null }>;
      const from = localDateFor(at, user.timezone, user.dayStartHour);
      await tx.habit.update({
        where: { id },
        data: {
          archivedAt: at,
          revision: { increment: 1 },
          journalMetadata: {
            ...metadata,
            archivedOn: from,
            inactiveRanges: [...ranges, { from, through: null }],
          },
        },
      });
      return true;
    });
  }
  async restore(id: string, userId: string, at = new Date()) {
    return this.p.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT "id" FROM "User" WHERE "id"=${userId}::uuid FOR UPDATE`;
      const habit = await tx.habit.findFirst({ where: { id, userId } }),
        user = await tx.user.findUnique({ where: { id: userId } });
      if (!habit || !user) return false;
      if (!habit.archivedAt) return true;
      const metadata = habit.journalMetadata as Prisma.InputJsonObject,
        from =
          typeof metadata.archivedOn === "string"
            ? metadata.archivedOn
            : localDateFor(habit.archivedAt, user.timezone, user.dayStartHour);
      const ranges = (metadata.inactiveRanges ?? [{ from, through: null }]) as Array<{
          from: string;
          through: string | null;
        }>,
        today = localDateFor(at, user.timezone, user.dayStartHour);
      await tx.habit.update({
        where: { id },
        data: {
          archivedAt: null,
          revision: { increment: 1 },
          journalMetadata: {
            ...metadata,
            archivedOn: null,
            inactiveRanges: ranges.map((range) =>
              range.through === null
                ? { ...range, through: today < range.from ? range.from : today }
                : range,
            ),
          },
        },
      });
      return true;
    });
  }
  async delete(id: string, userId: string, requireArchived = false) {
    return this.p.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT "id" FROM "User" WHERE "id"=${userId}::uuid FOR UPDATE`;
      if (
        !(await tx.habit.findFirst({
          where: { id, userId, ...(requireArchived ? { archivedAt: { not: null } } : {}) },
        }))
      )
        return false;
      await tx.habitTombstone.create({ data: { habitId: id, userId } });
      await tx.habit.delete({ where: { id } });
      return true;
    });
  }
  async reorder(userId: string, ids: string[]) {
    await this.p.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT "id" FROM "User" WHERE "id"=${userId}::uuid FOR UPDATE`;
      for (const [sortOrder, id] of ids.entries())
        await tx.habit.updateMany({
          where: { id, userId },
          data: { sortOrder, revision: { increment: 1 } },
        });
    });
  }
  async writeStats(s: HabitStats) {
    const x = {
      habitId: s.habitId,
      currentStreak: s.currentStreak,
      bestStreak: s.bestStreak,
      completionRate: s.completionRate,
      computedAt: s.computedAt,
    };
    await this.p.habitStats.upsert({ where: { habitId: s.habitId }, create: x, update: x });
  }
}
export class PrismaTemplateRepository implements TemplateRepository {
  constructor(private p: PrismaClient) {}
  async list(locale: "ru" | "en") {
    const rows = await this.p.habitTemplate.findMany({
      where: { locale },
      orderBy: [{ category: "asc" }, { title: "asc" }],
    });
    return rows.map((r) => ({
      ...r,
      defaultSchedule: r.defaultSchedule as HabitTemplate["defaultSchedule"],
      defaultType: r.defaultType,
    })) as HabitTemplate[];
  }
}
export class PrismaEntryRepository implements EntryRepository {
  constructor(private p: PrismaClient) {}
  async applyOperation(input: Parameters<EntryRepository["applyOperation"]>[0]) {
    return this.p.$transaction(async (tx) => {
      // Serialize a user's commits so sequence cursors cannot skip an uncommitted operation.
      await tx.$queryRaw`SELECT "id" FROM "User" WHERE "id" = ${input.userId}::uuid FOR UPDATE`;
      const habit = await tx.habit.findFirst({
        where: { id: input.habitId, userId: input.userId },
        include: { scheduleVersions: true },
      });
      const user = await tx.user.findUnique({ where: { id: input.userId } });
      if (!habit || !user) {
        if (
          user &&
          input.conflictOnIneligible &&
          (await tx.habitTombstone.findFirst({
            where: { habitId: input.habitId, userId: input.userId },
          }))
        )
          return {
            operationId: input.operationId,
            outcome: "conflict" as const,
            revision: 0,
            entry: null,
            reason: "HABIT_DELETED",
          };
        throw new Error("HABIT_NOT_FOUND");
      }
      const previous = await tx.entryOperation.findUnique({
        where: { userId_operationId: { userId: input.userId, operationId: input.operationId } },
      });
      if (previous) {
        if (previous.habitId !== input.habitId || ld(previous.localDate) !== input.localDate)
          throw new Error("OPERATION_ID_REUSED");
        const result = previous.result as unknown as EntryOperationResult;
        for (const field of ["entry", "state"] as const)
          if (result[field]) {
            const saved = result[field]!;
            const { value, ...entry } = saved;
            result[field] = {
              ...entry,
              ...(value == null ? {} : { value: Number(value) }),
              createdAt: new Date(saved.createdAt),
              updatedAt: new Date(saved.updatedAt),
            };
          }
        return result;
      }
      const old = await tx.entry.findUnique({
        where: { habitId_localDate: { habitId: input.habitId, localDate: d(input.localDate) } },
      });
      let effective = input;
      let dependencyConflict = false;
      if (input.dependsOn) {
        const dependency = await tx.entryOperation.findUnique({
          where: { userId_operationId: { userId: input.userId, operationId: input.dependsOn } },
        });
        if (
          !dependency ||
          dependency.habitId !== input.habitId ||
          ld(dependency.localDate) !== input.localDate
        )
          throw new Error("DEPENDENCY_NOT_FOUND");
        const result = dependency.result as unknown as EntryOperationResult;
        dependencyConflict = result.outcome === "conflict";
        effective = { ...input, baseRevision: result.revision };
      }
      const conflict = (reason: string) => ({
        next: null,
        result: {
          operationId: input.operationId,
          outcome: "conflict" as const,
          revision: old?.revision ?? 0,
          entry: old && !old.deleted ? E(old) : null,
          state: old ? E(old) : null,
          reason,
        },
      });
      const transition = () => {
        if (dependencyConflict) return conflict("DEPENDENCY_CONFLICT");
        try {
          return applyEntryChange(effective, H(habit), U(user), old ? E(old) : null, randomUUID());
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
      // Legacy queued operations predate the operation table. Preserve their first acceptance.
      const change =
        old?.clientId === input.operationId
          ? {
              next: null,
              result: {
                operationId: input.operationId,
                outcome: "applied" as const,
                revision: old.revision,
                entry: old.deleted ? null : E(old),
              },
            }
          : transition();
      if (change.next) {
        const next = change.next;
        const data = {
          userId: next.userId,
          habitId: next.habitId,
          localDate: d(next.localDate),
          clientId: next.clientId,
          value: next.value ?? null,
          status: next.status,
          source: next.source,
          revision: next.revision!,
          resetRevision: next.resetRevision!,
          deleted: next.deleted!,
          updatedAt: input.now,
        };
        await tx.entry.upsert({
          where: { habitId_localDate: { habitId: input.habitId, localDate: d(input.localDate) } },
          create: { ...data, id: next.id, createdAt: next.createdAt },
          update: data,
        });
      }
      await tx.entryOperation.create({
        data: {
          userId: input.userId,
          operationId: input.operationId,
          habitId: input.habitId,
          localDate: d(input.localDate),
          payload: JSON.parse(JSON.stringify(input)),
          result: JSON.parse(JSON.stringify(change.result)),
        },
      });
      return change.result;
    });
  }
  async deleteByHabit(habitId: string) {
    await this.p.entry.deleteMany({ where: { habitId } });
  }
  async listForHabit(habitId: string, through?: string) {
    return (
      await this.p.entry.findMany({
        where: { habitId, deleted: false, ...(through ? { localDate: { lte: d(through) } } : {}) },
      })
    ).map(E);
  }
  async listForUser(userId: string, from: string, through: string) {
    return (
      await this.p.entry.findMany({
        where: { userId, deleted: false, localDate: { gte: d(from), lte: d(through) } },
      })
    ).map(E);
  }
}
export class PrismaUserRepository implements UserRepository {
  constructor(private p: PrismaClient) {}
  async findById(id: string) {
    const r = await this.p.user.findUnique({ where: { id } });
    return r ? U(r) : null;
  }
  async findIdentity(provider: Identity["provider"], externalId: string) {
    const r = await this.p.identity.findUnique({
      where: { provider_externalId: { provider, externalId } },
      include: { user: true },
    });
    return r
      ? {
          identity: { id: r.id, userId: r.userId, provider: r.provider, externalId: r.externalId },
          user: U(r.user),
        }
      : null;
  }
  async findIdentityForUser(userId: string, provider: Identity["provider"]) {
    const r = await this.p.identity.findFirst({ where: { userId, provider } });
    return r
      ? { id: r.id, userId: r.userId, provider: r.provider, externalId: r.externalId }
      : null;
  }
  async addIdentity(userId: string, provider: Identity["provider"], externalId: string) {
    // upsert, а не create: пара (provider, externalId) уникальна в схеме, и голый
    // create падал бы на втором одновременном входе — а in-memory в том же месте
    // спокойно возвращает найденное. Одинаковое поведение здесь не роскошь: тесты
    // видят только вторую реализацию.
    const r = await this.p.identity.upsert({
      where: { provider_externalId: { provider, externalId } },
      create: { userId, provider, externalId },
      update: {},
    });
    return { id: r.id, userId: r.userId, provider: r.provider, externalId: r.externalId };
  }
  async createWithIdentity(i: Parameters<UserRepository["createWithIdentity"]>[0]) {
    const x = await this.findIdentity(i.provider, i.externalId);
    return (
      x?.user ??
      U(
        await this.p.user.create({
          data: {
            timezone: i.timezone,
            dayStartHour: i.dayStartHour,
            locale: i.locale,
            identities: { create: { provider: i.provider, externalId: i.externalId } },
          },
        }),
      )
    );
  }
  async update(id: string, i: Partial<Pick<User, "timezone" | "dayStartHour" | "locale">>) {
    return (await this.findById(id))
      ? U(await this.p.user.update({ where: { id }, data: i }))
      : null;
  }
  async delete(id: string) {
    return (await this.p.user.deleteMany({ where: { id } })).count > 0;
  }
}
export class PrismaReminderRepository implements ReminderRepository {
  constructor(private p: PrismaClient) {}
  async findById(id: string) {
    const r = await this.p.reminder.findUnique({ where: { id } });
    return r ? R(r) : null;
  }
  async due(now: Date, limit: number) {
    return (
      await this.p.reminder.findMany({
        where: { enabled: true, nextFireAt: { lte: now } },
        orderBy: { nextFireAt: "asc" },
        take: limit,
      })
    ).map(R);
  }
  async updateNextFireAt(id: string, at: Date) {
    return (await this.findById(id))
      ? R(await this.p.reminder.update({ where: { id }, data: { nextFireAt: at } }))
      : null;
  }
  async create(i: Omit<HabitReminder, "id">) {
    return R(
      await this.p.reminder.create({
        data: { ...i, localTime: new Date(`1970-01-01T${i.localTime}Z`) },
      }),
    );
  }
  async listByUser(userId: string) {
    return (await this.p.reminder.findMany({ where: { userId } })).map(R);
  }
  async deleteByHabit(habitId: string) {
    await this.p.reminder.deleteMany({ where: { habitId } });
  }
}
export const prismaRepositories = (p: PrismaClient) => ({
  habits: new PrismaHabitRepository(p),
  entries: new PrismaEntryRepository(p),
  users: new PrismaUserRepository(p),
  reminders: new PrismaReminderRepository(p),
  templates: new PrismaTemplateRepository(p),
});
