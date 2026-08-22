import { computeStreak, localDateFor } from "@ownday/core";
import type { Entry, LocalDate, ScheduleVersion } from "@ownday/core";

export type HabitSnapshot = {
  id: string;
  startedOn: LocalDate;
  scheduleVersions: ScheduleVersion[];
  entries: Entry[];
};

export const clientIdFor = (habitId: string, localDate: LocalDate) =>
  `mobile:${habitId}:${localDate}`;

export const entryDateFor = (now: Date, timezone: string, dayStartHour: number) =>
  localDateFor(now, timezone, dayStartHour);

export function optimisticStreak(
  habit: HabitSnapshot,
  localDate: LocalDate,
  status: Entry["status"],
) {
  const entries = habit.entries.filter((entry) => entry.localDate !== localDate);
  entries.push({ localDate, status });
  return computeStreak({
    versions: habit.scheduleVersions,
    entries,
    today: localDate,
    startedOn: habit.startedOn,
  });
}

export type StreakPillMode = "hidden" | "neutral" | "streak";
export function streakPillMode(current: number, best: number): StreakPillMode {
  if (current === 0) return "hidden";
  return current >= 7 || current === best ? "streak" : "neutral";
}
