import { describe, expect, it } from "vitest";
import { scheduleAt } from "@ownday/core";
import { createServices } from "./services.js";
import {
  InMemoryEntryRepository,
  InMemoryHabitRepository,
  InMemoryReminderRepository,
  InMemoryUserRepository,
} from "./memory.js";
const setup = (clock?: () => Date) => {
  const habits = new InMemoryHabitRepository(),
    entries = new InMemoryEntryRepository(),
    users = new InMemoryUserRepository(),
    reminders = new InMemoryReminderRepository();
  return {
    habits,
    entries,
    users,
    reminders,
    services: createServices({ habits, entries, users, reminders, clock }),
  };
};
async function base(s: ReturnType<typeof setup>, timezone = "UTC") {
  const user = await s.services.ensureUserFromTelegram("42", {
      timezone,
      locale: "ru",
      dayStartHour: 4,
    }),
    habit = await s.services.createHabit({
      userId: user.id,
      title: "Water",
      type: "binary",
      schedule: { kind: "daily" },
      validFrom: "2024-01-01",
    });
  habit.createdAt = new Date("2024-01-01T04:00:00Z");
  s.habits.habits.set(habit.id, habit);
  return { user, habit };
}
describe("application services", () => {
  it("is idempotent by clientId", async () => {
    const s = setup(),
      { user, habit } = await base(s),
      i = {
        userId: user.id,
        habitId: habit.id,
        localDate: "2024-01-02",
        status: "done",
        source: "tg",
        clientId: "11111111-1111-4111-8111-111111111111",
      } as const,
      a = await s.services.markEntry(i),
      b = await s.services.markEntry({ ...i, status: "skip" });
    expect(b).toEqual(a);
    expect(s.entries.entries.size).toBe(1);
  });
  it("computes a genuine non-system local date", async () => {
    const s = setup(),
      { user } = await base(s, "Pacific/Auckland"),
      rows = await s.services.listHabitsForToday(user.id, new Date("2024-01-01T16:30:00Z"));
    expect(rows[0]?.localDate).toBe("2024-01-02");
  });
  it("does not break streak on skip", async () => {
    const s = setup(),
      { user, habit } = await base(s);
    for (const [date, status, n] of [
      ["2024-01-01", "done", 1],
      ["2024-01-02", "skip", 2],
      ["2024-01-03", "done", 3],
    ] as const)
      await s.services.markEntry({
        userId: user.id,
        habitId: habit.id,
        localDate: date,
        status,
        source: "tg",
        clientId: `00000000-0000-4000-8000-00000000000${n}`,
      });
    expect(
      (await s.services.getHabitStats(habit.id, new Date("2024-01-03T12:00:00Z"))).currentStreak,
    ).toBe(2);
  });
  it("archives and reorders", async () => {
    const s = setup(),
      { user, habit } = await base(s),
      b = await s.services.createHabit({
        userId: user.id,
        title: "B",
        type: "binary",
        schedule: { kind: "daily" },
        validFrom: "2024-01-01",
      });
    await s.services.reorderHabits(user.id, [b.id, habit.id]);
    expect((await s.habits.listByUser(user.id))[0]?.id).toBe(b.id);
    expect(await s.services.archiveHabit(habit.id, user.id)).toBe(true);
  });
  it("undoes", async () => {
    const s = setup(),
      { user, habit } = await base(s);
    await s.services.markEntry({
      userId: user.id,
      habitId: habit.id,
      localDate: "2024-01-01",
      status: "done",
      source: "tg",
      clientId: "10000000-0000-4000-8000-000000000001",
    });
    expect(
      await s.services.undoEntry({ userId: user.id, habitId: habit.id, localDate: "2024-01-01" }),
    ).toBe(true);
  });
  it("creates one Telegram identity", async () => {
    const s = setup(),
      a = await s.services.ensureUserFromTelegram("7", { timezone: "UTC" }),
      b = await s.services.ensureUserFromTelegram("7", { timezone: "Asia/Tashkent" });
    expect(a.id).toBe(b.id);
    expect(s.users.users.size).toBe(1);
  });
  it("selects and advances reminders", async () => {
    const s = setup(),
      { user, habit } = await base(s),
      r = await s.reminders.create({
        userId: user.id,
        habitId: habit.id,
        localTime: "09:00",
        daysMask: 127,
        channel: "tg",
        enabled: true,
        nextFireAt: new Date("2024-01-01T08:00:00Z"),
      });
    expect(await s.services.dueReminders(new Date("2024-01-01T08:01:00Z"), 10)).toHaveLength(1);
    expect(
      (
        await s.services.advanceReminder(r.id, new Date("2024-01-01T08:01:00Z"))
      )?.nextFireAt.toISOString(),
    ).toBe("2024-01-01T09:00:00.000Z");
  });

  it("adds a schedule version without rewriting history", async () => {
    const now = new Date("2024-02-01T12:00:00Z");
    const s = setup(() => now);
    const { user, habit } = await base(s);
    const original = structuredClone(habit.scheduleVersions[0]);

    const updated = await s.services.updateHabit(habit.id, user.id, {
      schedule: { kind: "days_of_week", days: [1, 3, 5] },
    });

    expect(updated?.scheduleVersions).toHaveLength(2);
    expect(updated?.scheduleVersions[0]).toEqual(original);
    expect(updated?.scheduleVersions[1]).toEqual({
      validFrom: "2024-02-01",
      schedule: { kind: "days_of_week", days: [1, 3, 5] },
    });
    expect(scheduleAt(updated!.scheduleVersions, "2024-01-15")).toEqual({ kind: "daily" });
    expect(scheduleAt(updated!.scheduleVersions, "2024-02-01")).toEqual({
      kind: "days_of_week",
      days: [1, 3, 5],
    });
  });

  it("uses the owner's local habit date for validFrom and startedOn", async () => {
    const createdAt = new Date("2024-01-01T23:30:00Z");
    const s = setup(() => createdAt);
    const { user, habit } = await base(s, "Asia/Tashkent");
    habit.createdAt = createdAt;
    s.habits.habits.set(habit.id, habit);

    const updated = await s.services.updateHabit(habit.id, user.id, {
      schedule: { kind: "daily" },
    });
    expect(updated?.scheduleVersions.at(-1)?.validFrom).toBe("2024-01-02");

    await s.services.markEntry({
      userId: user.id,
      habitId: habit.id,
      localDate: "2024-01-02",
      status: "done",
      source: "tg",
      clientId: "20000000-0000-4000-8000-000000000001",
    });
    const stats = await s.services.getHabitStats(habit.id, new Date("2024-01-02T12:00:00Z"));
    expect(stats.completionRate).toBe(1);
  });
});
