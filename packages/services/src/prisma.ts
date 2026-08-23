import type { PrismaClient } from "@ownday/db";
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
    scheduleVersions: r.scheduleVersions.map((v: any) => ({
      validFrom: ld(v.validFrom),
      schedule: { kind: v.kind, ...v.config },
    })),
  }),
  E = (r: any): HabitEntry => ({
    ...r,
    localDate: ld(r.localDate),
    ...(r.value === null ? {} : { value: Number(r.value) }),
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
    return H(await this.p.habit.create({ data, include: { scheduleVersions: true } }));
  }
  async update(id: string, userId: string, i: Parameters<HabitRepository["update"]>[2]) {
    if (!(await this.p.habit.findFirst({ where: { id, userId } }))) return null;
    const data: any = { ...i };
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
    return H(
      await this.p.habit.update({ where: { id }, data, include: { scheduleVersions: true } }),
    );
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
    return (
      (await this.p.habit.updateMany({ where: { id, userId }, data: { archivedAt: at } })).count > 0
    );
  }
  async restore(id: string, userId: string) {
    return (
      (await this.p.habit.updateMany({ where: { id, userId }, data: { archivedAt: null } })).count >
      0
    );
  }
  async reorder(userId: string, ids: string[]) {
    await this.p.$transaction(
      ids.map((id, sortOrder) =>
        this.p.habit.updateMany({ where: { id, userId }, data: { sortOrder } }),
      ),
    );
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
  async findByClientId(clientId: string) {
    const row = await this.p.entry.findUnique({ where: { clientId } });
    return row ? E(row) : null;
  }
  async upsert(input: Parameters<EntryRepository["upsert"]>[0]) {
    return E(
      await this.p.entry.upsert({
        where: { habitId_localDate: { habitId: input.habitId, localDate: d(input.localDate) } },
        create: { ...input, localDate: d(input.localDate) },
        update: {},
      }),
    );
  }
  async setValue(input: Parameters<EntryRepository["setValue"]>[0]) {
    return E(
      await this.p.entry.upsert({
        where: { habitId_localDate: { habitId: input.habitId, localDate: d(input.localDate) } },
        create: { ...input, localDate: d(input.localDate), clientId: crypto.randomUUID() },
        update: { value: input.value, status: input.status, source: input.source },
      }),
    );
  }
  async delete(habitId: string, localDate: string, userId: string) {
    return (
      (
        await this.p.entry.deleteMany({
          where: { habitId, userId, localDate: d(localDate) },
        })
      ).count > 0
    );
  }
  async listForHabit(habitId: string, through?: string) {
    return (
      await this.p.entry.findMany({
        where: { habitId, ...(through ? { localDate: { lte: d(through) } } : {}) },
      })
    ).map(E);
  }
  async listForUser(userId: string, from: string, through: string) {
    return (
      await this.p.entry.findMany({
        where: { userId, localDate: { gte: d(from), lte: d(through) } },
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
}
export const prismaRepositories = (p: PrismaClient) => ({
  habits: new PrismaHabitRepository(p),
  entries: new PrismaEntryRepository(p),
  users: new PrismaUserRepository(p),
  reminders: new PrismaReminderRepository(p),
  templates: new PrismaTemplateRepository(p),
});
