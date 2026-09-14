import { localDateFor, nextFireAt, isDue, scheduleAt } from "@ownday/core";
import type { LocalSnapshot } from "./local-store";
import { habitActiveOn } from "./local-store";
export type PlannedNotification = {
  id: string;
  profileId: string;
  habitId: string;
  localDate: string;
  at: Date;
  title: string;
  body: string;
};
/** A rolling horizon bounded below iOS's pending notification limit. */
export function planNotifications(snapshot: LocalSnapshot, now: Date): PlannedNotification[] {
  const p = snapshot.preferences,
    end = now.getTime() + 14 * 86400000;
  const candidates = snapshot.habits
    .filter((h) => p.reminders?.[h.id] && !h.archivedOn)
    .map((habit) => ({
      habit,
      at: nextFireAt({ localTime: p.reminders![habit.id]!, daysMask: 127 }, p.timezone, now),
    }));
  const planned: PlannedNotification[] = [];
  while (candidates.length && planned.length < 60) {
    candidates.sort((a, b) => a.at.getTime() - b.at.getTime());
    const current = candidates[0]!;
    if (current.at.getTime() > end) break;
    const localDate = localDateFor(current.at, p.timezone, p.dayStartHour),
      habit = current.habit;
    const entry = snapshot.entries.find(
      (e) => e.habitId === habit.id && e.localDate === localDate && !e.deleted,
    );
    if (
      habitActiveOn(habit, localDate) &&
      isDue(scheduleAt(habit.scheduleVersions, localDate), localDate) &&
      entry?.status !== "done" &&
      entry?.status !== "skip"
    )
      planned.push({
        id: `ownday:${snapshot.profileId}:${habit.id}:${current.at.toISOString()}`,
        profileId: snapshot.profileId,
        habitId: habit.id,
        localDate,
        at: current.at,
        title: "Ownday",
        body: habit.title,
      });
    current.at = nextFireAt(
      { localTime: p.reminders![habit.id]!, daysMask: 127 },
      p.timezone,
      current.at,
    );
  }
  return planned;
}
