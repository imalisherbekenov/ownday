import type { ScheduleVersion } from "./index.js";
import type { EntryOperation, EntryValue } from "./operations.js";
import { assertEntryOperation, assertLocalDate, isUuid } from "./operations.js";
import { validateHabitFields, validateSchedule } from "./validation.js";

export type HabitSnapshot = {
  id: string;
  title: string;
  icon: string;
  type: "binary" | "counter" | "duration";
  targetValue: number | null;
  unit: string;
  time: "morning" | "afternoon" | "evening";
  scheduleVersions: ScheduleVersion[];
  startedOn: string;
  sortOrder: number;
  archivedOn: string | null;
  inactiveRanges: Array<{ from: string; through: string | null }>;
  revision: number;
  createdAt: string;
};
export type EntrySnapshot = EntryValue & { id: string; habitId: string; localDate: string };
export type HabitOperation = {
  operationId: string;
  habit: HabitSnapshot;
  baseRevision: number;
  dependsOn?: string;
};
export type SyncOperation =
  | { kind: "habit"; change: HabitOperation }
  | { kind: "entry"; change: EntryOperation };
export type SyncResult = {
  operationId: string;
  outcome: "applied" | "conflict";
  revision: number;
  reason?: string;
} & (
  | { kind: "habit"; habit: HabitSnapshot | null }
  | { kind: "entry"; entry: EntrySnapshot | null }
);
export type SyncSnapshot = {
  userId: string;
  habits: HabitSnapshot[];
  entries: EntrySnapshot[];
  preferences: { timezone: string; dayStartHour: number; locale: "ru" | "en" };
};
export function syncEntity(operation: SyncOperation) {
  return operation.kind === "habit"
    ? `habit:${operation.change.habit.id}`
    : `entry:${operation.change.habitId}:${operation.change.localDate}`;
}

export function assertSyncOperation(input: SyncOperation) {
  if (!input || typeof input !== "object") throw new Error("INVALID_OPERATION");
  if (input.kind === "entry") {
    assertEntryOperation(input.change);
    if (input.change.baseRevision === undefined) throw new Error("BASE_REVISION_REQUIRED");
    return;
  }
  if (input.kind !== "habit" || !input.change) throw new Error("INVALID_OPERATION");
  const { habit, operationId, baseRevision, dependsOn } = input.change;
  if (
    !isUuid(operationId) ||
    !habit ||
    !isUuid(habit.id) ||
    (dependsOn !== undefined && (!isUuid(dependsOn) || dependsOn === operationId))
  )
    throw new Error("INVALID_OPERATION_ID");
  if (
    !Number.isSafeInteger(baseRevision) ||
    baseRevision < 0 ||
    !Number.isSafeInteger(habit.revision) ||
    habit.revision < 1
  )
    throw new Error("INVALID_REVISION");
  validateHabitFields(habit);
  if (
    typeof habit.title !== "string" ||
    typeof habit.type !== "string" ||
    typeof habit.unit !== "string" ||
    (habit.targetValue !== null && typeof habit.targetValue !== "number")
  )
    throw new Error("INVALID_HABIT");
  assertLocalDate(habit.startedOn);
  if (
    !["morning", "afternoon", "evening"].includes(habit.time) ||
    typeof habit.icon !== "string" ||
    habit.icon.length > 64 ||
    !Number.isInteger(habit.sortOrder) ||
    habit.sortOrder < 0 ||
    habit.sortOrder > 1000000
  )
    throw new Error("INVALID_HABIT");
  if (!Number.isFinite(Date.parse(habit.createdAt))) throw new Error("INVALID_CREATED_AT");
  if (
    !Array.isArray(habit.scheduleVersions) ||
    !habit.scheduleVersions.length ||
    habit.scheduleVersions.length > 1000
  )
    throw new Error("INVALID_SCHEDULE");
  let previous = "";
  for (const version of habit.scheduleVersions) {
    assertLocalDate(version.validFrom);
    validateSchedule(version.schedule);
    if (version.validFrom <= previous || version.validFrom < habit.startedOn)
      throw new Error("INVALID_SCHEDULE_ORDER");
    previous = version.validFrom;
  }
  if (habit.scheduleVersions[0]!.validFrom !== habit.startedOn)
    throw new Error("INVALID_START_DATE");
  if (!Array.isArray(habit.inactiveRanges) || habit.inactiveRanges.length > 1000)
    throw new Error("INVALID_ARCHIVE");
  previous = habit.startedOn;
  for (const [index, range] of habit.inactiveRanges.entries()) {
    assertLocalDate(range.from);
    if (range.from < previous) throw new Error("INVALID_ARCHIVE");
    if (range.through !== null) {
      assertLocalDate(range.through);
      if (range.through < range.from) throw new Error("INVALID_ARCHIVE");
      previous = range.through;
    } else if (index !== habit.inactiveRanges.length - 1) throw new Error("INVALID_ARCHIVE");
  }
  if (habit.archivedOn !== null) assertLocalDate(habit.archivedOn);
  const last = habit.inactiveRanges.at(-1);
  if ((last?.through === null ? last.from : null) !== habit.archivedOn)
    throw new Error("INVALID_ARCHIVE");
}
