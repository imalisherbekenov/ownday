import { completionTotals, isDue, isoWeekday, localDateFor, scheduleAt, withInactiveDays } from "@ownday/core";
import type { Habit, HabitEntry, User } from "./types.js";

const shift = (date: string, days: number) =>
  new Date(Date.parse(`${date}T00:00:00Z`) + days * 86400000).toISOString().slice(0, 10);
export function buildUserSummary(
  habits: Habit[],
  entries: HabitEntry[],
  user: User,
  from: string,
  through: string,
) {
  const dates: string[] = [];
  for (let date = from; date <= through; date = shift(date, 1)) dates.push(date);
  const trend = dates.map((localDate) => ({
    localDate,
    done: 0,
    due: 0,
    rate: null as number | null,
  }));
  const weekdayBuckets = Array.from({ length: 7 }, () => ({ done: 0, due: 0 }));
  const habitSummaries = habits.map((habit) => {
    const startedOn = habit.scheduleVersions.reduce(
      (date, v) => (v.validFrom < date ? v.validFrom : date),
      "9999-12-31",
    );
    const archivedOn = habit.archivedAt
      ? habit.archivedOn ?? localDateFor(habit.archivedAt, user.timezone, user.dayStartHour)
      : null;
    const end = archivedOn && archivedOn <= through ? shift(archivedOn, -1) : through;
    const history = withInactiveDays(entries.filter((e) => e.habitId === habit.id && !e.deleted),habit.inactiveRanges??[],from,end);
    const byDate = new Map(history.map((e) => [e.localDate, e]));
    const counts = completionTotals({
      versions: habit.scheduleVersions,
      entries: history,
      startedOn: startedOn > from ? startedOn : from,
      today: end,
    });
    const habitTrend = dates.map((date, index) => {
      if (date < startedOn || date > end || !isDue(scheduleAt(habit.scheduleVersions, date), date))
        return null;
      const entry = byDate.get(date);
      if (entry?.status === "skip") return null;
      const done = entry?.status === "done" ? 1 : 0;
      trend[index]!.due++;
      trend[index]!.done += done;
      const bucket = weekdayBuckets[isoWeekday(date) - 1]!;
      bucket.due++;
      bucket.done += done;
      return done;
    });
    return {
      habitId: habit.id,
      ...counts,
      completionRate: counts.due ? counts.done / counts.due : null,
      trend: habitTrend,
    };
  });
  for (const point of trend) point.rate = point.due ? point.done / point.due : null;
  const done = habitSummaries.reduce((sum, h) => sum + h.done, 0);
  const due = habitSummaries.reduce((sum, h) => sum + h.due, 0);
  return {
    from,
    through,
    done,
    due,
    completionRate: due ? done / due : null,
    byWeekday: weekdayBuckets.map((b) => (b.due ? b.done / b.due : null)),
    perfectDays: trend.filter((p) => p.due > 0 && p.done === p.due).length,
    trend,
    habitSummaries,
  };
}
