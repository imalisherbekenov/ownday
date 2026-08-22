import { describe, expect, it, vi } from "vitest";
import { computeStreak, localDateFor } from "@ownday/core";
import { clientIdFor, entryDateFor, optimisticStreak, streakPillMode } from "./domain";
import { MutationQueue } from "./mutation-queue";
import type { QueuedMutation, QueueStorage } from "./mutation-queue";

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
