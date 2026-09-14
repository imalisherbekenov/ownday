import { describe, it, expect } from "vitest";
import { planNotifications } from "./notification-plan";
import type { LocalSnapshot } from "./local-store";
const snapshot = (): LocalSnapshot => ({
  profileId: "guest",
  preferences: {
    locale: "ru",
    theme: "light",
    timezone: "America/New_York",
    dayStartHour: 4,
    reminders: { water: "02:30" },
  },
  habits: [
    {
      id: "water",
      title: "Вода",
      icon: "water",
      type: "counter",
      targetValue: 8,
      unit: "",
      time: "morning",
      scheduleVersions: [{ validFrom: "2026-03-01", schedule: { kind: "daily" } }],
      startedOn: "2026-03-01",
      archivedOn: null,
      inactiveRanges: [],
      sortOrder: 0,
      revision: 1,
      createdAt: "2026-03-01T12:00:00Z",
    },
  ],
  entries: [],
  pending: 0,
  conflicts: 0,
});
describe("local notification planning", () => {
  it("uses the first valid spring-gap time and the configured logical day", () => {
    const plan = planNotifications(snapshot(), new Date("2026-03-08T06:00:00Z"));
    expect(plan[0]).toMatchObject({
      localDate: "2026-03-07",
      profileId: "guest",
      habitId: "water",
    });
    expect(plan[0]!.at.toISOString()).toBe("2026-03-08T07:00:00.000Z");
    expect(plan[1]!.at.toISOString()).toBe("2026-03-09T06:30:00.000Z");
    expect(new Set(plan.map((item) => item.id)).size).toBe(plan.length);
  });
  it("omits completed, skipped and archived habits", () => {
    const data = snapshot();
    data.entries = [
      {
        id: "entry",
        habitId: "water",
        localDate: "2026-03-07",
        value: 0,
        status: "skip",
        revision: 1,
        resetRevision: 1,
        deleted: false,
      },
    ];
    expect(planNotifications(data, new Date("2026-03-08T06:00:00Z"))[0]!.localDate).toBe(
      "2026-03-08",
    );
    data.habits[0]!.archivedOn = "2026-03-07";
    expect(planNotifications(data, new Date("2026-03-08T06:00:00Z"))).toEqual([]);
  });
  it("keeps the earliest 60 occurrences across all habits", () => {
    const data = snapshot(),
      template = data.habits[0]!;
    data.habits = Array.from({ length: 10 }, (_, i) => ({ ...template, id: `habit-${i}` }));
    data.preferences.reminders = Object.fromEntries(data.habits.map((h) => [h.id, "09:00"]));
    const plan = planNotifications(data, new Date("2026-03-08T06:00:00Z"));
    expect(plan).toHaveLength(60);
    expect(new Set(plan.slice(0, 10).map((item) => item.habitId)).size).toBe(10);
  });
});
