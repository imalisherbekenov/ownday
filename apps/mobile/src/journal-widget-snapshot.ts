import type { LocalStore } from "./local-store";
import { scheduled, shiftDay } from "./journal-model";

export function journalWidgetSnapshot(store: LocalStore) {
  const snapshot = store.snapshot(),
    today = store.today();
  const pending = store.outbox().map((item) => store.operation(item));
  return {
    version: 2,
    profileId: snapshot.profileId,
    timezone: snapshot.preferences.timezone,
    dayStartHour: snapshot.preferences.dayStartHour,
    locale: snapshot.preferences.locale,
    days: Array.from({ length: 31 }, (_, offset) => {
      const localDate = shiftDay(today, offset);
      return {
        localDate,
        habits: snapshot.habits
          .filter((habit) => scheduled(habit, localDate))
          .slice(0, 4)
          .map((habit) => {
            const entry = snapshot.entries.find(
              (item) => item.habitId === habit.id && item.localDate === localDate,
            );
            const dependency = pending
              .filter(
                (item) =>
                  item.kind === "entry" &&
                  item.change.habitId === habit.id &&
                  item.change.localDate === localDate,
              )
              .at(-1);
            return {
              id: habit.id,
              title: habit.title,
              done: Boolean(!entry?.deleted && entry?.status === "done"),
              value: entry?.deleted ? 0 : (entry?.value ?? 0),
              target: habit.type === "binary" ? null : habit.targetValue,
              revision: entry?.revision ?? 0,
              dependsOn: dependency?.change.operationId ?? null,
            };
          }),
      };
    }),
  };
}
