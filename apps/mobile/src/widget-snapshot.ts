import { computeStreak, localDateFor } from "@ownday/core";
import type { Bootstrap, TodayHabit } from "./types";
import type { QueuedMutation } from "./mutation-queue";
import { clientIdFor } from "./domain";

export const WIDGET_SNAPSHOT_KEY = "ownday.widget.snapshot.v1";

export type WidgetHabit = {
  id: string;
  title: string;
  done: boolean;
  value: number;
  target: number | null;
  streak: number;
};

export type WidgetSnapshot = {
  version: 1;
  localDate: string;
  habits: WidgetHabit[];
};

type NativeWidgetBridge = {
  writeSnapshot(value: string): Promise<void>;
  takePendingMutations(): Promise<string>;
};

async function nativeBridge() {
  const { NativeModules, Platform } = await import("react-native");
  return Platform.OS === "web"
    ? undefined
    : (NativeModules.OwndayWidgetBridge as NativeWidgetBridge | undefined);
}

export function serializeWidgetSnapshot(bootstrap: Bootstrap, now: Date = new Date()): string {
  const localDate = localDateFor(now, bootstrap.user.timezone, bootstrap.user.dayStartHour);
  const habits = bootstrap.today
    .filter((item) => item.localDate === localDate)
    .map(
      (item): WidgetHabit => ({
        id: item.habit.id,
        title: item.habit.title,
        done: item.entry?.status === "done",
        value: item.entry?.value ?? 0,
        target: item.habit.targetValue,
        streak: computeStreak({
          versions: item.habit.scheduleVersions,
          entries:
            item.entriesWithCurrent ??
            (item.entry
              ? [
                  ...item.entries.filter((candidate) => candidate.localDate !== item.localDate),
                  item.entry,
                ]
              : item.entries),
          today: localDate,
          startedOn: item.startedOn,
        }).current,
      }),
    );
  return JSON.stringify({ version: 1, localDate, habits } satisfies WidgetSnapshot);
}

export const widgetMutationFor = (
  habitId: string,
  localDate: string,
  done: boolean,
): QueuedMutation => ({
  habitId,
  localDate,
  status: done ? "miss" : "done",
  clientId: clientIdFor(habitId, localDate),
});

export async function writeWidgetSnapshot(bootstrap: Bootstrap, now?: Date) {
  const bridge = await nativeBridge();
  if (!bridge) return;
  await bridge.writeSnapshot(serializeWidgetSnapshot(bootstrap, now));
}

export async function takeWidgetMutations(): Promise<QueuedMutation[]> {
  const bridge = await nativeBridge();
  if (!bridge) return [];
  const raw = await bridge.takePendingMutations();
  return JSON.parse(raw) as QueuedMutation[];
}

export function withWidgetMark(item: TodayHabit, status: "done" | "miss"): TodayHabit {
  const entry = { localDate: item.localDate, status } as const;
  return {
    ...item,
    entry,
    entriesWithCurrent: [
      ...item.entries.filter((candidate) => candidate.localDate !== item.localDate),
      entry,
    ],
  };
}
