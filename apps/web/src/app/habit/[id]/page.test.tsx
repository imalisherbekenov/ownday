import { describe, expect, it, vi } from "vitest";
const snapshot = vi.hoisted(() => vi.fn());
vi.mock("next/navigation", () => ({
  notFound: () => {
    throw new Error("NOT_FOUND");
  },
}));
vi.mock("@/lib/services", () => ({ getCurrentUserId: async () => "owner" }));
vi.mock("@/lib/journal-service", () => ({ journalService: () => ({ snapshot }) }));
vi.mock("@/components/journal-day", () => ({ JournalDay: () => null }));
import HabitDetail from "./page";
describe("habit detail ownership", () => {
  it("only looks up the requested habit in the authenticated user's snapshot", async () => {
    snapshot.mockResolvedValue({
      userId: "owner",
      preferences: { timezone: "UTC", dayStartHour: 0, locale: "ru" },
      habits: [{ id: "owned" }],
      entries: [],
    });
    const page = await HabitDetail({ params: Promise.resolve({ id: "owned" }) });
    expect(snapshot).toHaveBeenCalledWith("owner");
    expect(page.props.habitId).toBe("owned");
    expect(page.props.initial.userId).toBe("owner");
  });
  it("returns not found for another user's habit before rendering history", async () => {
    snapshot.mockResolvedValue({ userId: "owner", habits: [], entries: [] });
    await expect(HabitDetail({ params: Promise.resolve({ id: "foreign" }) })).rejects.toThrow(
      "NOT_FOUND",
    );
  });
});
