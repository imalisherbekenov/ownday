import {
  assertEntryOperation,
  isDue,
  isInactiveOn,
  localDateFor,
  scheduleAt,
  transitionEntry,
} from "@ownday/core";
import type { Habit, HabitEntry, User } from "./types.js";
import type { EntryOperationInput, EntryOperationResult } from "./repositories.js";

export function applyEntryChange(
  input: EntryOperationInput,
  habit: Habit,
  user: User,
  current: HabitEntry | null,
  entryId: string,
): { result: EntryOperationResult; next: HabitEntry | null } {
  assertEntryOperation(input);
  const today = localDateFor(input.now, user.timezone, user.dayStartHour);
  const first = habit.scheduleVersions.reduce(
    (date, version) => (version.validFrom < date ? version.validFrom : date),
    "9999-12-31",
  );
  if (input.localDate > today || input.localDate < first)
    throw new Error("ENTRY_DATE_OUT_OF_RANGE");
  if (
    habit.archivedAt &&
    input.localDate >=
      (habit.archivedOn ?? localDateFor(habit.archivedAt, user.timezone, user.dayStartHour))
  )
    throw new Error("HABIT_ARCHIVED");
  if (isInactiveOn(habit.inactiveRanges ?? [], input.localDate)) throw new Error("HABIT_ARCHIVED");
  if (!isDue(scheduleAt(habit.scheduleVersions, input.localDate), input.localDate))
    throw new Error("HABIT_NOT_DUE");
  const revision = current?.revision ?? 0;
  const visible = current?.deleted ? null : current;
  const changed = transitionEntry(
    current
      ? {
          value: current.value ?? 0,
          status: current.status,
          revision,
          resetRevision: current.resetRevision ?? 0,
          deleted: current.deleted ?? false,
        }
      : null,
    input,
    habit,
  );
  if (!changed)
    return {
      next: null,
      result: {
        operationId: input.operationId,
        outcome: "conflict",
        revision,
        entry: visible,
        state: current,
      },
    };
  const next: HabitEntry = {
    id: current?.id ?? entryId,
    userId: input.userId,
    habitId: input.habitId,
    localDate: input.localDate,
    clientId: current?.clientId ?? input.operationId,
    source: input.source,
    ...changed,
    createdAt: current?.createdAt ?? input.now,
    updatedAt: input.now,
  };
  return {
    next,
    result: {
      operationId: input.operationId,
      outcome: "applied",
      revision: next.revision!,
      entry: changed.deleted ? null : next,
      state: next,
    },
  };
}
