import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({ notFound: vi.fn() }));
vi.mock("@/app/actions", () => ({ markHabitAction: vi.fn() }));
vi.mock("@/app/habits/actions", () => ({ archiveAction: vi.fn(), restoreAction: vi.fn() }));
vi.mock("@/components/primary-action-adapter", () => ({
  PrimaryActionAdapter: () => null,
}));
vi.mock("@/lib/view-data", () => ({
  heatPoints: () => [],
  scheduleDescription: () => "Daily",
  weekDays: () => [],
}));
vi.mock("@/lib/services", () => ({
  getCurrentUserId: async () => "user-1",
  repositories: { entries: { listForHabit: async () => [] } },
  services: {
    listHabits: async () => [
      {
        id: "habit-1",
        title: "Water",
        icon: "W",
        color: "moss",
        scheduleVersions: [{ validFrom: "2024-01-01", schedule: { kind: "daily" } }],
      },
    ],
    localDateForUser: async () => "2024-01-30",
    getHabitStats: async () => ({
      currentStreak: 0,
      bestStreak: 0,
      completionRate: null,
      byWeekday: [null, null, null, null, null, null, null],
    }),
  },
}));

import HabitDetail from "./page";

describe("HabitDetail", () => {
  it("renders its single web submit action inside the detail form", async () => {
    render(await HabitDetail({ params: Promise.resolve({ id: "habit-1" }) }));
    const button = screen.getByRole("button", { name: "Mark as done today" });
    expect(button).toHaveAttribute("type", "submit");
    expect(button).toHaveClass("primary");
    expect(button.closest("form")).toHaveAttribute("id", "detail-action");
    // Стеречь надо не число кнопок, а число primary-действий. MainButton в Telegram
    // отправляет форму сам и прячет внутри неё единственную button.primary — окажись
    // их две, одно нажатие дало бы две записи. Второстепенные действия (архив) primary
    // не носят и живут в своей форме, поэтому MainButton их не касается.
    expect(document.querySelectorAll("button.primary")).toHaveLength(1);
  });

  it("offers archiving as a separate action outside the primary form", async () => {
    render(await HabitDetail({ params: Promise.resolve({ id: "habit-1" }) }));
    const archive = screen.getByRole("button", { name: "Убрать в архив" });
    expect(archive).not.toHaveClass("primary");
    expect(archive.closest("form")).not.toHaveAttribute("id", "detail-action");
  });
});
