import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { SyncOperation, SyncSnapshot } from "@ownday/core";
import { transitionEntry } from "@ownday/core";
vi.mock("@/app/journal-actions", () => ({ applyJournalOperation: vi.fn() }));
vi.mock("./telegram-provider", () => ({ useTelegram: () => ({ webApp: null }) }));
import { applyJournalOperation } from "@/app/journal-actions";
import { JournalDay } from "./journal-day";
const today = new Date().toISOString().slice(0, 10);
const habitId = "01800000-0000-4000-8000-000000000002";
function data(): SyncSnapshot {
  return {
    userId: "01800000-0000-4000-8000-000000000001",
    preferences: { timezone: "UTC", dayStartHour: 0, locale: "ru" },
    habits: [
      {
        id: habitId,
        title: "Вода",
        type: "counter",
        icon: "water",
        time: "morning",
        targetValue: 8,
        unit: "л",
        revision: 1,
        createdAt: new Date().toISOString(),
        startedOn: today,
        archivedOn: null,
        inactiveRanges: [],
        sortOrder: 0,
        scheduleVersions: [{ validFrom: today, schedule: { kind: "daily" } }],
      },
    ],
    entries: [],
  };
}
afterEach(() => {
  cleanup();
  sessionStorage.clear();
  vi.clearAllMocks();
});
describe("web journal mutations", () => {
  it("retries a lost response with the same operation identifier", async () => {
    const initial = data();
    vi.mocked(applyJournalOperation)
      .mockRejectedValueOnce(new Error("network"))
      .mockImplementationOnce(async (_, operation) => {
        if (operation.kind !== "entry") throw new Error("unexpected");
        return {
          kind: "entry",
          operationId: operation.change.operationId,
          outcome: "applied",
          revision: 1,
          entry: {
            ...transitionEntry(null, operation.change, initial.habits[0]!)!,
            id: crypto.randomUUID(),
            habitId,
            localDate: today,
          },
        };
      });
    render(<JournalDay initial={initial} initialDate={today} />);
    fireEvent.click(screen.getByRole("button", { name: "Увеличить: Вода" }));
    await screen.findByRole("button", { name: "Повторить" });
    const first = vi.mocked(applyJournalOperation).mock.calls[0]![1];
    fireEvent.click(screen.getByRole("button", { name: "Повторить" }));
    await waitFor(() => expect(applyJournalOperation).toHaveBeenCalledTimes(2));
    expect(vi.mocked(applyJournalOperation).mock.calls[1]![1]).toEqual(first);
    await screen.findByText("1 / 8 л");
  });
  it("preserves an intended 6.5 across reload and a remote clear", async () => {
    const initial = data(),
      operation: SyncOperation = {
        kind: "entry",
        change: {
          operationId: crypto.randomUUID(),
          habitId,
          localDate: today,
          baseRevision: 3,
          action: { kind: "increment", delta: 1 },
        },
      };
    const remote = {
      id: crypto.randomUUID(),
      habitId,
      localDate: today,
      value: 0,
      status: "miss" as const,
      deleted: true,
      revision: 4,
      resetRevision: 4,
    };
    sessionStorage.setItem(
      `ownday.web.pending:${initial.userId}`,
      JSON.stringify({ operation, intended: { ...remote, value: 6.5, deleted: false } }),
    );
    initial.entries = [remote];
    vi.mocked(applyJournalOperation).mockResolvedValue({
      kind: "entry",
      operationId: operation.change.operationId,
      outcome: "conflict",
      revision: 4,
      reason: "REVISION_CONFLICT",
      entry: remote,
    });
    render(<JournalDay initial={initial} initialDate={today} />);
    fireEvent.click(await screen.findByRole("button", { name: "Повторить" }));
    await screen.findByText(/Твоё значение: 6.5/);
    fireEvent.click(screen.getByRole("button", { name: "Оставить серверное" }));
    expect(sessionStorage.getItem(`ownday.web.pending:${initial.userId}`)).toBeNull();
    expect(screen.getByText("0 / 8 л")).toBeInTheDocument();
  });
  it("allows browsing a future day but disables check-ins", () => {
    const initial = data(),
      future = new Date(Date.now() + 86400000).toISOString().slice(0, 10);
    render(<JournalDay initial={initial} initialDate={future} />);
    expect(screen.getByRole("button", { name: "Увеличить: Вода" })).toBeDisabled();
    expect(applyJournalOperation).not.toHaveBeenCalled();
  });
  it("counts scheduled dates with missing entries in the habit calendar", () => {
    const initial = data();
    initial.habits[0]!.startedOn = "2024-01-01";
    initial.habits[0]!.scheduleVersions = [
      { validFrom: "2024-01-01", schedule: { kind: "daily" } },
    ];
    render(<JournalDay initial={initial} initialDate="2024-01-15" habitId={habitId} />);
    expect(screen.getByText("Цель за месяц: 0 / 31 · 0%")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "2024-01-03: Нет отметки" }));
    expect(screen.getByRole("button", { name: "2024-01-03: Нет отметки" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
  });
  it("removes a remotely deleted habit after accepting the conflict", async () => {
    const initial = data();
    vi.mocked(applyJournalOperation).mockImplementation(async (_, operation) => ({
      kind: "entry",
      operationId: operation.change.operationId,
      outcome: "conflict",
      revision: 0,
      reason: "HABIT_DELETED",
      entry: null,
    }));
    render(<JournalDay initial={initial} initialDate={today} />);
    fireEvent.click(screen.getByRole("button", { name: "Увеличить: Вода" }));
    fireEvent.click(await screen.findByRole("button", { name: "Оставить серверное" }));
    expect(screen.queryByRole("button", { name: "Увеличить: Вода" })).not.toBeInTheDocument();
  });
});
