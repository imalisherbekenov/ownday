import { beforeEach, describe, expect, it, vi } from "vitest";
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
import { markHabitAction } from "./actions";
import { repositories, services } from "@/lib/services";
import {
  InMemoryEntryRepository,
  InMemoryHabitRepository,
  InMemoryUserRepository,
} from "@ownday/services";
describe("markHabitAction", () => {
  let userId: string, habitId: string;
  beforeEach(async () => {
    (repositories.habits as InMemoryHabitRepository).habits.clear();
    (repositories.entries as InMemoryEntryRepository).entries.clear();
    (repositories.users as InMemoryUserRepository).users.clear();
    (repositories.users as InMemoryUserRepository).identities = [];
    const user = await repositories.users.createWithIdentity({
      provider: "email",
      externalId: "action@test.local",
      timezone: "UTC",
      dayStartHour: 4,
      locale: "en",
    });
    userId = user.id;
    habitId = (
      await services.createHabit({
        userId,
        title: "Test",
        type: "binary",
        schedule: { kind: "daily" },
        validFrom: "2026-01-01",
      })
    ).id;
  });
  it("marks a binary habit done", async () => {
    const data = new FormData();
    data.set("habitId", habitId);
    data.set("intent", "done");
    await markHabitAction(userId, "2026-08-22", data);
    expect((await repositories.entries.listForHabit(habitId))[0]?.status).toBe("done");
  });
  it("undoes an entry", async () => {
    await services.markEntry({
      userId,
      habitId,
      localDate: "2026-08-22",
      status: "done",
      source: "web",
      clientId: crypto.randomUUID(),
    });
    const data = new FormData();
    data.set("habitId", habitId);
    data.set("intent", "undo");
    await markHabitAction(userId, "2026-08-22", data);
    expect(await repositories.entries.listForHabit(habitId)).toHaveLength(0);
  });
});
