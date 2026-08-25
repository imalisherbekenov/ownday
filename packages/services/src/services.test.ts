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
  it("is idempotent by habit and local date", async () => {
    const s = setup(),
      { user, habit } = await base(s),
      input = {
        userId: user.id,
        habitId: habit.id,
        localDate: "2024-01-02",
        status: "done",
        source: "tg",
      } as const;
    const first = await s.services.markEntry({
      ...input,
      clientId: "11111111-1111-4111-8111-111111111112",
    });
    const second = await s.services.markEntry({
      ...input,
      source: "web",
      clientId: "11111111-1111-4111-8111-111111111113",
    });
    expect(second.id).toBe(first.id);
    expect(s.entries.entries.size).toBe(1);
  });
  it("excludes days before a habit existed from the user summary", async () => {
    const now = new Date("2024-01-30T12:00:00Z"),
      s = setup(() => now),
      { user, habit } = await base(s);
    habit.createdAt = new Date("2024-01-30T04:00:00Z");
    habit.scheduleVersions[0]!.validFrom = "2024-01-30";
    s.habits.habits.set(habit.id, habit);
    await s.services.markEntry({
      userId: user.id,
      habitId: habit.id,
      localDate: "2024-01-30",
      status: "done",
      source: "web",
      clientId: "11111111-1111-4111-8111-111111111114",
    });
    await expect(s.services.getUserSummary(user.id, { days: 30, now })).resolves.toMatchObject({
      done: 1,
      due: 1,
      completionRate: 1,
    });
  });
  it("starts summary obligations at the earliest schedule validFrom", async () => {
    const now = new Date("2024-01-30T12:00:00Z"),
      s = setup(() => now),
      { user, habit } = await base(s);
    habit.createdAt = new Date("2024-01-01T04:00:00Z");
    habit.scheduleVersions[0]!.validFrom = "2024-01-29";
    s.habits.habits.set(habit.id, habit);
    await s.services.markEntry({
      userId: user.id,
      habitId: habit.id,
      localDate: "2024-01-30",
      status: "done",
      source: "web",
      clientId: "11111111-1111-4111-8111-111111111115",
    });
    await s.services.markEntry({
      userId: user.id,
      habitId: habit.id,
      localDate: "2024-01-29",
      status: "done",
      source: "web",
      clientId: "11111111-1111-4111-8111-111111111116",
    });
    await expect(s.services.listHabitsForToday(user.id, now)).resolves.toMatchObject([
      { startedOn: "2024-01-29", streak: { current: 2, best: 2 } },
    ]);
    await expect(s.services.getHabitStats(habit.id, now)).resolves.toMatchObject({
      currentStreak: 2,
      bestStreak: 2,
      completionRate: 1,
      byWeekday: [1, 1, null, null, null, null, null],
    });
    await expect(s.services.getUserSummary(user.id, { days: 30, now })).resolves.toEqual({
      from: "2024-01-01",
      through: "2024-01-30",
      done: 2,
      due: 2,
      completionRate: 1,
      byWeekday: [1, 1, null, null, null, null, null],
    });
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
  it("returns an existing Google identity without changing identities", async () => {
    const s = setup();
    const first = await s.services.ensureUserFromOAuth({
      provider: "google",
      externalId: "google-1",
      email: "first@example.com",
      emailVerified: true,
      timezone: "UTC",
    });
    const second = await s.services.ensureUserFromOAuth({
      provider: "google",
      externalId: "google-1",
      email: "other@example.com",
      emailVerified: true,
      timezone: "Asia/Tashkent",
    });
    expect(second.id).toBe(first.id);
    expect(s.users.identities).toHaveLength(2);
  });
  it("links a verified Google email to the existing email account", async () => {
    const s = setup();
    const emailUser = await s.users.createWithIdentity({
      provider: "email",
      externalId: "person@example.com",
      timezone: "UTC",
      dayStartHour: 4,
      locale: "en",
    });
    const googleUser = await s.services.ensureUserFromOAuth({
      provider: "google",
      externalId: "google-2",
      email: "person@example.com",
      emailVerified: true,
      timezone: "UTC",
    });
    expect(googleUser.id).toBe(emailUser.id);
    expect((await s.users.findIdentity("google", "google-2"))?.user.id).toBe(emailUser.id);
    expect(s.users.users.size).toBe(1);
  });
  it("does not link an unverified Google email to the existing email account", async () => {
    const s = setup();
    const emailUser = await s.users.createWithIdentity({
      provider: "email",
      externalId: "person@example.com",
      timezone: "UTC",
      dayStartHour: 4,
      locale: "en",
    });
    const googleUser = await s.services.ensureUserFromOAuth({
      provider: "google",
      externalId: "google-3",
      email: "person@example.com",
      emailVerified: false,
      timezone: "UTC",
    });
    expect(googleUser.id).not.toBe(emailUser.id);
    expect(await s.users.findIdentityForUser(googleUser.id, "email")).toBeNull();
    expect(s.users.users.size).toBe(2);
  });
  it("creates Google and email identities for a new verified account", async () => {
    const s = setup();
    const user = await s.services.ensureUserFromOAuth({
      provider: "google",
      externalId: "google-4",
      email: "new@example.com",
      emailVerified: true,
      timezone: "UTC",
    });
    expect((await s.users.findIdentity("google", "google-4"))?.user.id).toBe(user.id);
    expect((await s.users.findIdentity("email", "new@example.com"))?.user.id).toBe(user.id);
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
    habit.scheduleVersions[0]!.validFrom = "2024-01-02";
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
