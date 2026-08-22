import { describe, expect, it } from "vitest";
import { InMemoryHabitRepository, InMemoryUserRepository } from "./memory.js";
import { createServices } from "./services.js";
import { InMemoryEntryRepository, InMemoryReminderRepository } from "./memory.js";
const setup = async () => {
  const habits = new InMemoryHabitRepository(),
    users = new InMemoryUserRepository(),
    services = createServices({
      habits,
      users,
      entries: new InMemoryEntryRepository(),
      reminders: new InMemoryReminderRepository(),
    }),
    user = await users.createWithIdentity({
      provider: "email",
      externalId: "test@ownday.local",
      timezone: "UTC",
      dayStartHour: 4,
      locale: "ru",
    });
  return { habits, services, user };
};
describe("habit mutations", () => {
  it("adds a schedule version without rewriting history", async () => {
    const { services, user } = await setup(),
      habit = await services.createHabit({
        userId: user.id,
        title: "Read",
        type: "binary",
        schedule: { kind: "daily" },
        validFrom: "2026-01-01",
      });
    await services.updateHabit(habit.id, user.id, {
      schedule: { kind: "days_of_week", days: [1, 3, 5] },
      validFrom: "2026-08-22",
    });
    const updated = (await services.listHabits(user.id))[0]!;
    expect(updated.scheduleVersions).toHaveLength(2);
    expect(updated.scheduleVersions[0]?.schedule).toEqual({ kind: "daily" });
  });
  it("persists reordered habit ids", async () => {
    const { services, user } = await setup(),
      a = await services.createHabit({
        userId: user.id,
        title: "A",
        type: "binary",
        schedule: { kind: "daily" },
        validFrom: "2026-01-01",
      }),
      b = await services.createHabit({
        userId: user.id,
        title: "B",
        type: "binary",
        schedule: { kind: "daily" },
        validFrom: "2026-01-01",
      });
    await services.reorderHabits(user.id, [b.id, a.id]);
    expect((await services.listHabits(user.id)).map((h) => h.id)).toEqual([b.id, a.id]);
  });
});
