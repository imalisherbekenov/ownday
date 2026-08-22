import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { HabitForm, type HabitFormHabit } from "./habit-form";

const initial = (type: HabitFormHabit["type"]): HabitFormHabit => ({
  title: "Test habit",
  type,
  icon: "check",
  color: "moss",
  targetValue: type === "binary" ? null : 10,
  unit: type === "binary" ? null : "units",
  scheduleVersions: [{ schedule: { kind: "daily" }, validFrom: "2026-01-01" }],
});

describe("HabitForm", () => {
  it.each([
    ["binary", false],
    ["counter", true],
    ["duration", true],
  ] as const)("shows target fields for %s", (type, visible) => {
    render(<HabitForm initial={initial(type)} action={vi.fn()} />);
    expect(Boolean(screen.queryByTestId("target-fields"))).toBe(visible);
  });
  it.each([
    ["daily", null],
    ["days_of_week", "days-settings"],
    ["times_per_week", "times-settings"],
    ["interval_days", "interval-settings"],
  ] as const)("shows settings for %s", (schedule, testId) => {
    render(<HabitForm action={vi.fn()} />);
    fireEvent.click(screen.getByTestId(`schedule-${schedule}`));
    if (testId) expect(screen.getByTestId(testId)).toBeInTheDocument();
    else
      for (const id of ["days-settings", "times-settings", "interval-settings"])
        expect(screen.queryByTestId(id)).not.toBeInTheDocument();
  });
});
