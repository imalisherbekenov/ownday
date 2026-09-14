import type { Schedule } from "./index.js";
import { assertLocalDate } from "./operations.js";
export function validateSchedule(schedule: Schedule) {
  if (!schedule || typeof schedule !== "object") throw new Error("INVALID_SCHEDULE");
  switch (schedule.kind) {
    case "daily":
      return;
    case "days_of_week":
      if (
        !Array.isArray(schedule.days) ||
        !schedule.days.length ||
        new Set(schedule.days).size !== schedule.days.length ||
        schedule.days.some((day) => !Number.isInteger(day) || day < 1 || day > 7)
      )
        throw new Error("INVALID_SCHEDULE");
      return;
    case "times_per_week":
    case "times_per_month":
      if (
        !Number.isInteger(schedule.target) ||
        schedule.target < 1 ||
        schedule.target > (schedule.kind === "times_per_week" ? 7 : 31)
      )
        throw new Error("INVALID_SCHEDULE");
      return;
    case "interval_days":
      if (!Number.isInteger(schedule.every) || schedule.every < 1 || schedule.every > 366)
        throw new Error("INVALID_SCHEDULE");
      assertLocalDate(schedule.anchor);
      return;
    default:
      throw new Error("INVALID_SCHEDULE");
  }
}

export function sameSchedule(a: Schedule, b: Schedule): boolean {
  if (a.kind !== b.kind) return false;
  switch (a.kind) {
    case "daily":
      return true;
    case "days_of_week":
      return (
        b.kind === "days_of_week" && [...a.days].sort().join(",") === [...b.days].sort().join(",")
      );
    case "interval_days":
      return b.kind === "interval_days" && a.every === b.every && a.anchor === b.anchor;
    case "times_per_week":
      return b.kind === "times_per_week" && a.target === b.target;
    case "times_per_month":
      return b.kind === "times_per_month" && a.target === b.target;
  }
}
export function validateHabitFields(input: {
  title?: string | undefined;
  type?: string | undefined;
  targetValue?: number | null | undefined;
  unit?: string | null | undefined;
}) {
  if (
    input.title !== undefined &&
    (typeof input.title !== "string" || !input.title.trim() || input.title.length > 160)
  )
    throw new Error("INVALID_TITLE");
  if (input.type !== undefined && !["binary", "counter", "duration"].includes(input.type))
    throw new Error("INVALID_HABIT_TYPE");
  const value = input.targetValue;
  if (
    value !== undefined &&
    value !== null &&
    (!Number.isFinite(value) ||
      value <= 0 ||
      value > 999999999.999 ||
      Math.abs(value * 1000 - Math.round(value * 1000)) > 0.0001)
  )
    throw new Error("INVALID_TARGET");
  if (
    input.unit !== undefined &&
    input.unit !== null &&
    (typeof input.unit !== "string" || input.unit.length > 32)
  )
    throw new Error("INVALID_UNIT");
}
