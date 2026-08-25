import { describe, expect, it } from "vitest";
import type { Schedule } from "@ownday/core";
import { scheduleDescription } from "./view-data";

describe("scheduleDescription", () => {
  it.each([
    [{ kind: "daily" }, "Daily"],
    [
      { kind: "days_of_week", days: [1, 3, 5] as number[] },
      "Specific weekdays: Monday, Wednesday, Friday",
    ],
    [{ kind: "times_per_week", target: 3 }, "3 times per week"],
    [{ kind: "times_per_month", target: 2 }, "2 times per month"],
    [{ kind: "interval_days", every: 4, anchor: "2024-01-01" }, "Every 4 days"],
  ] satisfies Array<[Schedule, string]>)("formats $kind schedules", (schedule, expected) => {
    expect(scheduleDescription(schedule)).toBe(expected);
  });
});
