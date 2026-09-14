import { completionRate, computeStreak, isDue, scheduleAt, withInactiveDays } from "@ownday/core";
import { habitActiveOn } from "./local-store";
import type { LocalHabit, LocalSnapshot } from "./local-store";

export const shiftDay = (date: string, delta: number) =>
  new Date(Date.parse(`${date}T12:00:00Z`) + delta * 86400000).toISOString().slice(0, 10);
export function scheduled(habit: LocalHabit, date: string) {
  return habitActiveOn(habit, date) && isDue(scheduleAt(habit.scheduleVersions, date), date);
}
export function historyFor(snapshot: LocalSnapshot, habit: LocalHabit, through: string) {
  const history = snapshot.entries.filter(
    (e) => e.habitId === habit.id && !e.deleted && e.localDate <= through,
  );
  return withInactiveDays(history,habit.inactiveRanges,habit.startedOn,through);
}
export function habitMetrics(snapshot: LocalSnapshot, habit: LocalHabit, today: string, days = 30) {
  const entries = historyFor(snapshot, habit, today),
    from = shiftDay(today, 1 - days);
  return {
    streak: computeStreak({
      versions: habit.scheduleVersions,
      entries,
      startedOn: habit.startedOn,
      today,
    }),
    rate: completionRate({
      versions: habit.scheduleVersions,
      entries,
      startedOn: habit.startedOn > from ? habit.startedOn : from,
      today,
    }),
  };
}
export function dailyProgress(snapshot: LocalSnapshot, date: string) {
  const habits = snapshot.habits.filter((h) => scheduled(h, date));
  const entries = new Map(
    snapshot.entries.filter((e) => !e.deleted && e.localDate === date).map((e) => [e.habitId, e]),
  );
  const due = habits.filter((h) => entries.get(h.id)?.status !== "skip").length;
  const done = habits.filter((h) => entries.get(h.id)?.status === "done").length;
  return { done, due, rate: due ? done / due : null };
}
