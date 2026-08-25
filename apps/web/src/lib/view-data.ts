import type { HabitEntry } from "@ownday/services";
import type { Schedule } from "@ownday/core";

const weekdays = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

export function scheduleDescription(schedule: Schedule): string {
  if (schedule.kind === "daily") return "Daily";
  if (schedule.kind === "days_of_week")
    return `Specific weekdays: ${schedule.days.map((day) => weekdays[day - 1]!).join(", ")}`;
  if (schedule.kind === "times_per_week") return `${schedule.target} times per week`;
  if (schedule.kind === "times_per_month") return `${schedule.target} times per month`;
  return `Every ${schedule.every} days`;
}
export function shiftDate(date: string, days: number) {
  return new Date(Date.parse(`${date}T00:00:00Z`) + days * 86400000).toISOString().slice(0, 10);
}
export function weekDays(today: string, entries: HabitEntry[] = []) {
  const date = new Date(`${today}T00:00:00Z`);
  const monday = shiftDate(today, -((date.getUTCDay() + 6) % 7));
  return ["M", "T", "W", "T", "F", "S", "S"].map((letter, i) => {
    const localDate = shiftDate(monday, i);
    const entry = entries.find((e) => e.localDate === localDate);
    return {
      letter,
      date: Number(localDate.slice(8)),
      today: localDate === today,
      ...(localDate > today ? { state: "future" as const } : entry ? { state: entry.status } : {}),
      fraction: entry?.status === "done" ? 1 : 0,
    };
  });
}
export function heatPoints(today: string, entries: HabitEntry[]) {
  return Array.from({ length: 364 }, (_, index) => {
    const date = shiftDate(today, index - 363);
    const entry = entries.find((e) => e.localDate === date);
    const intensity: 0 | 1 | 2 | 3 | 4 =
      entry?.status === "done"
        ? (Math.min(4, Math.max(1, Math.ceil((entry.value ?? 4) / 4))) as 1 | 2 | 3 | 4)
        : 0;
    return { date, intensity };
  });
}
