import { describe, expect, it, vi } from "vitest";
import { computeStreak, localDateFor } from "@ownday/core";
import { clientIdFor, entryDateFor, optimisticStreak, streakPillMode } from "./domain";
import { MutationQueue } from "./mutation-queue";
import type { QueuedMutation, QueueStorage } from "./mutation-queue";
import { serializeWidgetSnapshot, widgetMutationFor, withWidgetMark } from "./widget-snapshot";
import type { Bootstrap, TodayHabit } from "./types";

function memoryStorage(initial: QueuedMutation[] = []): QueueStorage {
  let items = structuredClone(initial);
  return {
    load: async () => structuredClone(items),
    save: async (next) => {
      items = structuredClone(next);
    },
  };
}

const mutation: QueuedMutation = {
  habitId: "habit-1",
  localDate: "2026-08-22",
  status: "done",
  clientId: clientIdFor("habit-1", "2026-08-22"),
};

describe("persistent mutation queue", () => {
  it("keeps an offline mark queued", async () => {
    const queue = new MutationQueue(memoryStorage(), vi.fn());
    await queue.enqueue(mutation);
    expect(await queue.size()).toBe(1);
  });

  it("sends a queued mark exactly once when connectivity returns", async () => {
    const send = vi.fn(async () => undefined);
    const queue = new MutationQueue(memoryStorage([mutation]), send);
    await Promise.all([queue.flush(), queue.flush()]);
    expect(send).toHaveBeenCalledTimes(1);
    expect(await queue.size()).toBe(0);
  });

  it("deduplicates the same clientId in the queue and on an idempotent server", async () => {
    const accepted = new Set<string>();
    const writes = vi.fn(async (item: QueuedMutation) => {
      accepted.add(item.clientId);
    });
    const queue = new MutationQueue(memoryStorage(), writes);
    await queue.enqueue(mutation);
    await queue.enqueue({ ...mutation });
    await queue.flush();
    await queue.enqueue(mutation);
    await queue.flush();
    expect(accepted.size).toBe(1);
  });
});

describe("widget snapshot and mutation path", () => {
  const item: TodayHabit = {
    habit: {
      id: "habit-1",
      title: "Read",
      icon: "book",
      color: "hue-moss",
      type: "counter",
      targetValue: 10,
      unit: "pages",
      scheduleVersions: [{ validFrom: "2026-08-19", schedule: { kind: "daily" } }],
    },
    localDate: "2026-08-22",
    entry: { localDate: "2026-08-22", status: "done", value: 4 },
    entries: [
      { localDate: "2026-08-19", status: "done" },
      { localDate: "2026-08-20", status: "done" },
      { localDate: "2026-08-21", status: "skip" },
    ],
    startedOn: "2026-08-19",
    streak: { current: 3, best: 3, unit: "day" },
  };
  const bootstrap: Bootstrap = {
    user: { timezone: "UTC", dayStartHour: 0, locale: "en" },
    today: [item, { ...item, localDate: "2026-08-21", habit: { ...item.habit, id: "old" } }],
  };

  it("serializes today's status, counter and computeStreak result", () => {
    const value = JSON.parse(
      serializeWidgetSnapshot(bootstrap, new Date("2026-08-22T12:00:00Z")),
    ) as { habits: Array<{ done: boolean; value: number; streak: number }> };
    expect(value.habits).toEqual([
      { id: "habit-1", title: "Read", done: true, value: 4, target: 10, streak: 3 },
    ]);
  });

  it("rewrites the serialized snapshot after a mark", () => {
    const marked = { ...bootstrap, today: [withWidgetMark(item, "miss")] };
    expect(serializeWidgetSnapshot(marked, new Date("2026-08-22T12:00:00Z"))).not.toBe(
      serializeWidgetSnapshot(bootstrap, new Date("2026-08-22T12:00:00Z")),
    );
  });

  it("uses the same clientId as an in-app mark", () => {
    expect(widgetMutationFor("habit-1", "2026-08-22", false).clientId).toBe(
      clientIdFor("habit-1", "2026-08-22"),
    );
  });

  it("keeps an offline widget mark in the shared queue", async () => {
    const queue = new MutationQueue(
      memoryStorage(),
      vi.fn(async () => {
        throw new Error("offline");
      }),
    );
    await queue.enqueue(widgetMutationFor("habit-1", "2026-08-22", false));
    await expect(queue.flush()).rejects.toThrow("offline");
    expect(await queue.size()).toBe(1);
  });
});

describe("shared domain behaviour", () => {
  const versions = [{ validFrom: "2026-08-19", schedule: { kind: "daily" as const } }];
  const entries = [
    { localDate: "2026-08-19", status: "done" as const },
    { localDate: "2026-08-20", status: "done" as const },
    { localDate: "2026-08-21", status: "skip" as const },
  ];

  it("optimistic streak is the exact computeStreak result", () => {
    const expectedEntries = [...entries, { localDate: "2026-08-22", status: "done" as const }];
    expect(
      optimisticStreak(
        { id: "habit-1", startedOn: "2026-08-19", scheduleVersions: versions, entries },
        "2026-08-22",
        "done",
      ),
    ).toEqual(
      computeStreak({
        versions,
        entries: expectedEntries,
        today: "2026-08-22",
        startedOn: "2026-08-19",
      }),
    );
  });

  it.each([
    [0, 9, "hidden"],
    [3, 9, "neutral"],
    [7, 9, "streak"],
    [3, 3, "streak"],
  ] as const)("selects pill mode for streak %i", (current, best, expected) => {
    expect(streakPillMode(current, best)).toBe(expected);
  });

  it("derives entry date from the user's timezone and day boundary", () => {
    const instant = new Date("2026-08-22T01:30:00.000Z");
    expect(entryDateFor(instant, "America/Los_Angeles", 4)).toBe(
      localDateFor(instant, "America/Los_Angeles", 4),
    );
    expect(entryDateFor(instant, "America/Los_Angeles", 4)).toBe("2026-08-21");
  });
});
