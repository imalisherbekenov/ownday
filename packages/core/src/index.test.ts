import { describe, expect, it } from "vitest";
import {
  completionByWeekday,
  completionRate,
  computeStreak,
  isDue,
  localDateFor,
  nextFireAt,
  scheduleAt,
  type Entry,
  type ScheduleVersion,
} from "./index.js";

const daily: ScheduleVersion[] = [{ validFrom: "2024-01-01", schedule: { kind: "daily" } }];
const streak = (entries: Entry[], today = "2024-01-05") =>
  computeStreak({ versions: daily, entries, today, startedOn: "2024-01-01" });

describe("local dates", () => {
  it("compares the wall clock at the day boundary across DST changes", () => {
    expect(localDateFor(new Date("2024-03-31T02:30:00Z"), "Europe/Berlin", 4)).toBe("2024-03-31");
    expect(localDateFor(new Date("2024-03-31T01:30:00Z"), "Europe/Berlin", 4)).toBe("2024-03-30");
    expect(localDateFor(new Date("2024-10-27T02:30:00Z"), "Europe/Berlin", 4)).toBe("2024-10-26");
    expect(localDateFor(new Date("2024-10-27T03:00:00Z"), "Europe/Berlin", 4)).toBe("2024-10-27");
  });
  it("rolls an early check-in into the previous habit day", () =>
    expect(localDateFor(new Date("2024-01-02T01:30:00Z"), "UTC", 4)).toBe("2024-01-01"));
  it("handles Berlin spring-forward using Intl timezone conversion", () =>
    expect(localDateFor(new Date("2024-03-31T01:30:00Z"), "Europe/Berlin", 0)).toBe("2024-03-31"));
  it("handles Berlin fall-back using Intl timezone conversion", () => {
    expect(localDateFor(new Date("2024-10-27T00:30:00Z"), "Europe/Berlin", 0)).toBe("2024-10-27");
    expect(localDateFor(new Date("2024-10-27T01:30:00Z"), "Europe/Berlin", 0)).toBe("2024-10-27");
  });
  it("handles a half-hour-offset timezone", () =>
    expect(localDateFor(new Date("2024-02-01T18:45:00Z"), "Asia/Kolkata", 0)).toBe("2024-02-02"));
});

describe("schedules", () => {
  it("selects historical versions without changing past dates", () => {
    const versions: ScheduleVersion[] = [
      { validFrom: "2024-02-01", schedule: { kind: "daily" } },
      { validFrom: "2024-03-01", schedule: { kind: "days_of_week", days: [1] } },
    ];
    expect(scheduleAt(versions, "2024-02-20").kind).toBe("daily");
    expect(isDue(scheduleAt(versions, "2024-03-05"), "2024-03-05")).toBe(false);
  });
  it("supports weekday and interval schedules in both directions from anchor", () => {
    expect(isDue({ kind: "days_of_week", days: [1, 5] }, "2024-01-01")).toBe(true);
    expect(isDue({ kind: "interval_days", every: 3, anchor: "2024-01-04" }, "2024-01-01")).toBe(
      true,
    );
    expect(isDue({ kind: "times_per_week", target: 3 }, "2024-01-01")).toBe(true);
  });
});

describe("streaks", () => {
  it("applies done, skip, and miss and survives a skip", () => {
    expect(
      streak([
        { localDate: "2024-01-01", status: "miss" },
        { localDate: "2024-01-02", status: "done" },
        { localDate: "2024-01-03", status: "skip" },
        { localDate: "2024-01-04", status: "done" },
      ]),
    ).toEqual({ current: 2, best: 2, unit: "day" });
  });
  it("does not let an explicit miss today survive", () =>
    expect(streak([{ localDate: "2024-01-05", status: "miss" }])).toEqual({
      current: 0,
      best: 0,
      unit: "day",
    }));
  it("does not break for an unentered today", () =>
    expect(
      computeStreak({
        versions: daily,
        entries: [
          { localDate: "2024-01-01", status: "done" },
          { localDate: "2024-01-02", status: "done" },
        ],
        today: "2024-01-03",
        startedOn: "2024-01-01",
      }).current,
    ).toBe(2));
  it("returns zero for empty history after past dates lapse", () =>
    expect(streak([])).toEqual({ current: 0, best: 0, unit: "day" }));
  it("does not let a March schedule change alter February best", () => {
    const versions: ScheduleVersion[] = [
      { validFrom: "2024-02-26", schedule: { kind: "daily" } },
      { validFrom: "2024-03-01", schedule: { kind: "days_of_week", days: [1] } },
    ];
    const entries: Entry[] = ["2024-02-26", "2024-02-27", "2024-02-28", "2024-02-29"].map(
      (localDate) => ({ localDate, status: "done" }),
    );
    expect(
      computeStreak({ versions, entries, today: "2024-03-04", startedOn: "2024-02-26" }).best,
    ).toBe(4);
  });
  it("counts complete ISO weeks and leaves current week unclosed", () => {
    const versions: ScheduleVersion[] = [
      { validFrom: "2024-01-01", schedule: { kind: "times_per_week", target: 2 } },
    ];
    const entries: Entry[] = ["2024-01-01", "2024-01-03", "2024-01-08", "2024-01-10"].map(
      (localDate) => ({ localDate, status: "done" }),
    );
    expect(
      computeStreak({ versions, entries, today: "2024-01-17", startedOn: "2024-01-01" }),
    ).toEqual({ current: 2, best: 2, unit: "week" });
  });
  it("counts completed calendar months", () => {
    const versions: ScheduleVersion[] = [
      { validFrom: "2024-01-01", schedule: { kind: "times_per_month", target: 1 } },
    ];
    expect(
      computeStreak({
        versions,
        entries: [{ localDate: "2024-01-10", status: "done" }],
        today: "2024-02-05",
        startedOn: "2024-01-01",
      }),
    ).toEqual({ current: 1, best: 1, unit: "month" });
  });
});

describe("completion rate", () => {
  it("uses period quotas, excludes duplicate dates and caps excess completions", () => {
    const entries: Entry[] = ["2024-01-01", "2024-01-02", "2024-01-03", "2024-01-03"].map(
      (localDate) => ({ localDate, status: "done" }),
    );
    for (const kind of ["times_per_week", "times_per_month"] as const) {
      expect(
        completionRate({
          versions: [{ validFrom: "2024-01-01", schedule: { kind, target: 3 } }],
          entries,
          startedOn: "2024-01-01",
          today: kind === "times_per_week" ? "2024-01-07" : "2024-01-31",
        }),
      ).toBe(1);
    }
  });
  it("preserves a completed period when a later target changes and excludes archived days", () => {
    const versions: ScheduleVersion[] = [
      { validFrom: "2024-01-01", schedule: { kind: "times_per_week", target: 1 } },
      { validFrom: "2024-01-08", schedule: { kind: "times_per_week", target: 3 } },
    ];
    expect(
      completionRate({
        versions,
        entries: [{ localDate: "2024-01-01", status: "done" }],
        startedOn: "2024-01-01",
        today: "2024-01-14",
      }),
    ).toBe(0.25);
    expect(
      completionRate({
        versions: daily,
        entries: [{ localDate: "2024-01-01", status: "done" }],
        startedOn: "2024-01-01",
        today: "2024-01-14",
        through: "2024-01-01",
      }),
    ).toBe(1);
  });
  it("excludes skips from denominator", () =>
    expect(
      completionRate({
        versions: daily,
        startedOn: "2024-01-01",
        today: "2024-01-03",
        entries: [
          { localDate: "2024-01-01", status: "done" },
          { localDate: "2024-01-02", status: "skip" },
          { localDate: "2024-01-03", status: "miss" },
        ],
      }),
    ).toBe(0.5));
  it("returns null for a zero denominator", () =>
    expect(
      completionRate({
        versions: daily,
        startedOn: "2024-01-01",
        today: "2024-01-01",
        entries: [{ localDate: "2024-01-01", status: "skip" }],
      }),
    ).toBeNull());
});

describe("completion by weekday", () => {
  it("returns null at weekday positions that are never due", () => {
    const versions: ScheduleVersion[] = [
      { validFrom: "2024-01-01", schedule: { kind: "days_of_week", days: [1, 3] } },
    ];
    expect(
      completionByWeekday({
        versions,
        startedOn: "2024-01-01",
        today: "2024-01-10",
        entries: [
          { localDate: "2024-01-01", status: "done" },
          { localDate: "2024-01-03", status: "miss" },
          { localDate: "2024-01-08", status: "done" },
        ],
      }),
    ).toEqual([1, null, 0, null, null, null, null]);
  });

  it("excludes skips from a weekday denominator", () => {
    expect(
      completionByWeekday({
        versions: daily,
        startedOn: "2024-01-01",
        today: "2024-01-15",
        entries: [
          { localDate: "2024-01-01", status: "done" },
          { localDate: "2024-01-08", status: "skip" },
          { localDate: "2024-01-15", status: "miss" },
        ],
      })[0],
    ).toBe(0.5);
  });
});

describe("reminders", () => {
  it("supports half-hour transitions and a skipped calendar date", () => {
    expect(
      nextFireAt(
        { localTime: "02:15", daysMask: 127 },
        "Australia/Lord_Howe",
        new Date("2026-10-03T14:00:00Z"),
      ).toISOString(),
    ).toBe("2026-10-03T15:30:00.000Z");
    expect(
      nextFireAt(
        { localTime: "09:00", daysMask: 127 },
        "Pacific/Apia",
        new Date("2011-12-29T20:00:00Z"),
      ).toISOString(),
    ).toBe("2011-12-30T19:00:00.000Z");
  });
  it("moves to tomorrow when today's reminder has already fired", () => {
    expect(
      nextFireAt(
        { localTime: "12:00", daysMask: 127 },
        "UTC",
        new Date("2026-09-13T12:00:00Z"),
      ).toISOString(),
    ).toBe("2026-09-14T12:00:00.000Z");
    expect(
      nextFireAt(
        { localTime: "12:00", daysMask: 127 },
        "UTC",
        new Date("2026-09-13T16:10:00Z"),
      ).toISOString(),
    ).toBe("2026-09-14T12:00:00.000Z");
  });
  it("does not repeat a delivery in the second occurrence of an autumn hour", () => {
    expect(
      nextFireAt(
        { localTime: "01:30", daysMask: 127 },
        "America/New_York",
        new Date("2026-11-01T05:45:00Z"),
      ).toISOString(),
    ).toBe("2026-11-02T06:30:00.000Z");
  });
  it("does not repeat a missed spring gap delivery later on the same day", () => {
    expect(
      nextFireAt(
        { localTime: "02:30", daysMask: 127 },
        "America/New_York",
        new Date("2026-03-08T07:05:00Z"),
      ).toISOString(),
    ).toBe("2026-03-09T06:30:00.000Z");
  });
  it("finds a normal next local firing instant", () =>
    expect(
      nextFireAt(
        { localTime: "09:30", daysMask: [1, 2, 3, 4, 5, 6, 7] },
        "Asia/Kolkata",
        new Date("2024-01-01T00:00:00Z"),
      ).toISOString(),
    ).toBe("2024-01-01T04:00:00.000Z"));
  it("honors spring-forward by firing at the first valid time after a gap", () =>
    expect(
      nextFireAt(
        { localTime: "02:30", daysMask: [7] },
        "Europe/Berlin",
        new Date("2024-03-30T12:00:00Z"),
      ).toISOString(),
    ).toBe("2024-03-31T01:00:00.000Z"));
  it("chooses the next occurrence during fall-back", () =>
    expect(
      nextFireAt(
        { localTime: "02:30", daysMask: [7] },
        "Europe/Berlin",
        new Date("2024-10-26T12:00:00Z"),
      ).toISOString(),
    ).toBe("2024-10-27T00:30:00.000Z"));
});
