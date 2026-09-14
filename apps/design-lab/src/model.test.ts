import { describe, expect, it } from "vitest";
import {
  changeEntry,
  dates,
  dayStats,
  entryFor,
  habitRate,
  isDemoData,
  keyFor,
  seedData,
  shiftDate,
  streak,
  summary,
  TODAY,
} from "./model";
import type { DemoData } from "./model";

describe("design lab interaction and statistics", () => {
  it("restores a counter after skipping and unskipping, including after reload", () => {
    const original = seedData(),
      habit = original.habits[0]!;
    const skipped = JSON.parse(JSON.stringify(changeEntry(original, habit, TODAY, "skip")));
    expect(entryFor(changeEntry(skipped, habit, TODAY, "skip"), habit, TODAY)).toEqual(
      entryFor(original, habit, TODAY),
    );
  });
  it("keeps repeated completion, undo and counters reversible", () => {
    const original = seedData(),
      habit = original.habits[0]!;
    let data = changeEntry(original, habit, TODAY, "toggle");
    expect(entryFor(data, habit, TODAY)).toEqual({ status: "done", value: 8 });
    data = changeEntry(data, habit, TODAY, "toggle");
    expect(entryFor(data, habit, TODAY)).toBeUndefined();
    data = changeEntry(data, habit, TODAY, -1);
    expect(entryFor(data, habit, TODAY)).toBeUndefined();
    data = changeEntry(data, habit, TODAY, 8);
    data = changeEntry(data, habit, TODAY, -1);
    expect(entryFor(data, habit, TODAY)).toEqual({ status: "partial", value: 7 });
    expect(entryFor(original, habit, TODAY)?.value).toBe(4);
  });
  it("excludes an intentional pause from completion and preserves its preceding streak", () => {
    const habit = { ...seedData().habits[0]!, startedOn: shiftDate(TODAY, -2) };
    let data: DemoData = { habits: [habit], entries: {} };
    for (const date of dates(shiftDate(TODAY, -1), 2))
      data = changeEntry(data, habit, date, "toggle");
    data = changeEntry(data, habit, TODAY, "skip");
    expect(streak(data, habit, TODAY)).toBe(2);
    expect(habitRate(data, habit, TODAY, 3)).toEqual({ done: 2, due: 2, percent: 100 });
    expect(dayStats(data, TODAY).due).toBe(0);
    expect(summary(data, TODAY, 3).perfect).toBe(2);
  });
  it("does not call a day perfect when a scheduled habit has no entry", () => {
    const habits = seedData()
      .habits.slice(0, 2)
      .map((h) => ({ ...h, startedOn: TODAY }));
    const data: DemoData = {
      habits,
      entries: { [keyFor(habits[0]!.id, TODAY)]: { status: "done", value: 8 } },
    };
    expect(summary(data, TODAY, 1)).toMatchObject({ percent: 50, perfect: 0 });
  });
  it("counts a three-times-per-week target as complete after three check-ins", () => {
    const habit = {
      ...seedData().habits[0]!,
      schedule: "weekly" as const,
      weeklyTarget: 3,
      startedOn: "2026-09-07",
    };
    let data: DemoData = { habits: [habit], entries: {} };
    for (const date of ["2026-09-07", "2026-09-09", "2026-09-11"])
      data = changeEntry(data, habit, date, "toggle");
    expect(habitRate(data, habit, TODAY, 7)).toEqual({ done: 3, due: 3, percent: 100 });
  });
  it("does not write future or unscheduled dates", () => {
    const data = seedData(),
      habit = { ...data.habits[0]!, schedule: "weekdays" as const };
    expect(changeEntry(data, habit, TODAY, "toggle")).toBe(data);
    expect(changeEntry(data, data.habits[0]!, shiftDate(TODAY, 1), "toggle")).toBe(data);
  });
  it("preserves data through the same JSON round-trip used by browser storage", () => {
    let data = seedData("offline");
    const habit = data.habits[0]!;
    data = changeEntry(data, habit, TODAY, 1);
    const restored: unknown = JSON.parse(JSON.stringify(data));
    expect(isDemoData(restored)).toBe(true);
    expect(restored).toEqual(data);
    expect(isDemoData({ habits: [{ id: "broken" }], entries: {} })).toBe(false);
    expect(isDemoData({ habits: [], entries: { invalid: null } })).toBe(false);
  });
  it("keeps scenarios independent and reflects completed and empty states honestly", () => {
    const data = seedData("complete");
    expect(dayStats(data, TODAY)).toMatchObject({ done: 5, due: 5, percent: 100 });
    expect(seedData("new")).toEqual({ habits: [], entries: {} });
    data.habits[0]!.title.ru = "Изменено";
    expect(seedData().habits[0]!.title.ru).not.toBe("Изменено");
  });
  it("gives individual habits their own statistics and evaluates the selected period", () => {
    const data = seedData();
    const rates = data.habits.map((habit) => habitRate(data, habit, TODAY, 7).percent);
    expect(new Set(rates).size).toBeGreaterThan(1);
    expect(summary(data, TODAY, 30).due).toBeGreaterThan(summary(data, TODAY, 7).due);
  });
});
