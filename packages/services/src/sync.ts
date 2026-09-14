import { assertSyncOperation, localDateFor, sameSchedule } from "@ownday/core";
import type {
  HabitSnapshot,
  EntrySnapshot,
  HabitOperation,
  SyncOperation,
  SyncResult,
  SyncSnapshot,
} from "@ownday/core";
import type { PrismaClient, Prisma, User as DbUser, Entry as DbEntry } from "@ownday/db";
import { PrismaEntryRepository } from "./prisma.js";
type DbHabit = Prisma.HabitGetPayload<{ include: { scheduleVersions: true } }>;
const date = (value: Date) => value.toISOString().slice(0, 10);
export function toHabitSnapshot(habit: DbHabit, user: DbUser): HabitSnapshot {
  const metadata = habit.journalMetadata as Partial<
    Pick<HabitSnapshot, "time" | "inactiveRanges" | "archivedOn">
  >;
  const versions = habit.scheduleVersions
    .map((v) => ({
      validFrom: date(v.validFrom),
      schedule: {
        ...(v.config as object),
        kind: v.kind,
      } as HabitSnapshot["scheduleVersions"][number]["schedule"],
    }))
    .sort((a, b) => a.validFrom.localeCompare(b.validFrom));
  const startedOn =
    versions[0]?.validFrom ?? localDateFor(habit.createdAt, user.timezone, user.dayStartHour);
  const archivedOn = habit.archivedAt
    ? (metadata.archivedOn ?? localDateFor(habit.archivedAt, user.timezone, user.dayStartHour))
    : null;
  return {
    id: habit.id,
    title: habit.title,
    icon: habit.icon,
    type: habit.type,
    targetValue: habit.targetValue === null ? null : Number(habit.targetValue),
    unit: habit.unit ?? "",
    time: metadata.time ?? "morning",
    scheduleVersions: versions.length
      ? versions
      : [{ validFrom: startedOn, schedule: { kind: "daily" } }],
    startedOn,
    sortOrder: habit.sortOrder,
    archivedOn,
    inactiveRanges:
      metadata.inactiveRanges ?? (archivedOn ? [{ from: archivedOn, through: null }] : []),
    revision: habit.revision,
    createdAt: habit.createdAt.toISOString(),
  };
}
export function toEntrySnapshot(entry: DbEntry): EntrySnapshot {
  return {
    id: entry.id,
    habitId: entry.habitId,
    localDate: date(entry.localDate),
    value: entry.value === null ? 0 : Number(entry.value),
    status: entry.status,
    revision: entry.revision,
    resetRevision: entry.resetRevision,
    deleted: entry.deleted,
  };
}

export class SyncService {
  constructor(
    private db: PrismaClient,
    private clock = () => new Date(),
  ) {}
  async snapshot(userId: string): Promise<SyncSnapshot> {
    return this.db.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT "id" FROM "User" WHERE "id"=${userId}::uuid FOR UPDATE`;
      const user = await tx.user.findUniqueOrThrow({ where: { id: userId } });
      const habits = await tx.habit.findMany({
        where: { userId },
        include: { scheduleVersions: true },
        orderBy: { sortOrder: "asc" },
      });
      const entries = await tx.entry.findMany({ where: { userId } });
      return {
        userId,
        habits: habits.map((h) => toHabitSnapshot(h, user)),
        entries: entries.map(toEntrySnapshot),
        preferences: {
          timezone: user.timezone,
          dayStartHour: user.dayStartHour,
          locale: user.locale === "ru" ? "ru" : "en",
        },
      };
    });
  }
  async change(
    userId: string,
    operation: SyncOperation,
    source: "mobile" | "web" = "mobile",
  ): Promise<SyncResult> {
    assertSyncOperation(operation);
    if (operation.kind === "habit") return this.changeHabit(userId, operation.change);
    const result = await new PrismaEntryRepository(this.db).applyOperation({
      ...operation.change,
      userId,
      source,
      now: this.clock(),
      conflictOnIneligible: true,
    });
    const entry = result.state ?? result.entry;
    return {
      kind: "entry",
      operationId: result.operationId,
      outcome: result.outcome,
      revision: result.revision,
      ...(result.reason ? { reason: result.reason } : {}),
      entry: entry
        ? {
            id: entry.id,
            habitId: entry.habitId,
            localDate: entry.localDate,
            value: entry.value ?? 0,
            status: entry.status,
            revision: entry.revision ?? 0,
            resetRevision: entry.resetRevision ?? 0,
            deleted: entry.deleted ?? false,
          }
        : null,
    };
  }
  async operationHistory(userId: string) {
    const [entries, habits] = await Promise.all([
      this.db.entryOperation.findMany({
        where: { userId },
        orderBy: { sequence: "asc" },
        select: { operationId: true, payload: true, result: true, createdAt: true },
      }),
      this.db.habitOperation.findMany({
        where: { userId },
        orderBy: { createdAt: "asc" },
        select: { operationId: true, payload: true, result: true, createdAt: true },
      }),
    ]);
    return { entries, habits };
  }
  private async changeHabit(userId: string, operation: HabitOperation): Promise<SyncResult> {
    return this.db.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT "id" FROM "User" WHERE "id"=${userId}::uuid FOR UPDATE`;
      const user = await tx.user.findUniqueOrThrow({ where: { id: userId } });
      const existing = await tx.habit.findUnique({
        where: { id: operation.habit.id },
        include: { scheduleVersions: true },
      });
      if (existing && existing.userId !== userId) throw new Error("HABIT_NOT_FOUND");
      const deleted = await tx.habitTombstone.findUnique({
        where: { habitId: operation.habit.id },
      });
      if (deleted) {
        if (deleted.userId !== userId) throw new Error("HABIT_NOT_FOUND");
        return {
          kind: "habit",
          operationId: operation.operationId,
          outcome: "conflict",
          revision: 0,
          habit: null,
          reason: "HABIT_DELETED",
        };
      }
      const previous = await tx.habitOperation.findUnique({
        where: { userId_operationId: { userId, operationId: operation.operationId } },
      });
      if (previous) {
        if (previous.habitId !== operation.habit.id) throw new Error("OPERATION_ID_REUSED");
        return previous.result as unknown as SyncResult;
      }
      let base = operation.baseRevision,
        blocked = false;
      if (operation.dependsOn) {
        const dependency = await tx.habitOperation.findUnique({
          where: { userId_operationId: { userId, operationId: operation.dependsOn } },
        });
        if (!dependency || dependency.habitId !== operation.habit.id)
          throw new Error("DEPENDENCY_NOT_FOUND");
        const result = dependency.result as unknown as SyncResult;
        base = result.revision;
        blocked = result.outcome === "conflict";
      }
      const current = existing ? toHabitSnapshot(existing, user) : null;
      const conflict = (reason: string, habit = current): SyncResult => ({
        kind: "habit",
        operationId: operation.operationId,
        outcome: "conflict",
        revision: habit?.revision ?? 0,
        habit,
        reason,
      });
      let result: SyncResult;
      if (blocked) result = conflict("DEPENDENCY_CONFLICT");
      else if ((existing?.revision ?? 0) !== base || (!existing && base !== 0))
        result = conflict("STALE_REVISION");
      else {
        const habit = operation.habit,
          today = localDateFor(this.clock(), user.timezone, user.dayStartHour);
        const historicalChange =
          current &&
          current.scheduleVersions.some((v) => {
            const next = habit.scheduleVersions.find((next) => next.validFrom === v.validFrom);
            return v.validFrom < today && (!next || !sameSchedule(next.schedule, v.schedule));
          });
        if (current && (habit.type !== current.type || habit.startedOn !== current.startedOn))
          result = conflict("IMMUTABLE_HABIT_FIELDS");
        else if (historicalChange) result = conflict("HISTORICAL_SCHEDULE_IMMUTABLE");
        else {
          const data = {
            title: habit.title.trim(),
            icon: habit.icon,
            type: habit.type,
            targetValue: habit.targetValue,
            unit: habit.unit,
            sortOrder: habit.sortOrder,
            revision: base + 1,
            archivedAt: habit.archivedOn ? (existing?.archivedAt ?? this.clock()) : null,
            journalMetadata: {
              time: habit.time,
              inactiveRanges: habit.inactiveRanges,
              archivedOn: habit.archivedOn,
            },
          };
          const changed = existing
            ? await tx.habit.updateMany({ where: { id: habit.id, userId, revision: base }, data })
            : null;
          if (changed && changed.count !== 1) {
            const latest = await tx.habit.findUnique({
              where: { id: habit.id },
              include: { scheduleVersions: true },
            });
            result = conflict("STALE_REVISION", latest ? toHabitSnapshot(latest, user) : null);
          } else {
            if (!existing)
              await tx.habit.create({
                data: {
                  ...data,
                  id: habit.id,
                  userId,
                  color: "moss",
                  category: "general",
                  createdAt: new Date(habit.createdAt),
                },
              });
            for (const version of habit.scheduleVersions) {
              const validFrom = new Date(`${version.validFrom}T00:00:00Z`);
              await tx.scheduleVersion.upsert({
                where: { habitId_validFrom: { habitId: habit.id, validFrom } },
                create: {
                  habitId: habit.id,
                  validFrom,
                  kind: version.schedule.kind,
                  config: version.schedule,
                },
                update: { kind: version.schedule.kind, config: version.schedule },
              });
            }
            const saved = await tx.habit.findUniqueOrThrow({
              where: { id: habit.id },
              include: { scheduleVersions: true },
            });
            result = {
              kind: "habit",
              operationId: operation.operationId,
              outcome: "applied",
              revision: saved.revision,
              habit: toHabitSnapshot(saved, user),
            };
          }
        }
      }
      await tx.habitOperation.create({
        data: {
          userId,
          habitId: operation.habit.id,
          operationId: operation.operationId,
          payload: JSON.parse(JSON.stringify(operation)),
          result: JSON.parse(JSON.stringify(result)),
        },
      });
      return result;
    });
  }
}
