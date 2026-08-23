import type { PrismaClient } from "@ownday/db";
import { describe, expect, it, vi } from "vitest";
import { PrismaEntryRepository } from "./prisma.js";

const entryRow = {
  id: "entry-1",
  userId: "user-1",
  habitId: "habit-1",
  localDate: new Date("2026-08-23T00:00:00Z"),
  value: null,
  status: "done",
  source: "web",
  clientId: "client-1",
  createdAt: new Date("2026-08-23T10:00:00Z"),
  updatedAt: new Date("2026-08-23T10:00:00Z"),
};

const setup = () => {
  const upsert = vi.fn().mockResolvedValue(entryRow);
  const client = { entry: { upsert } } as unknown as PrismaClient;
  return { repository: new PrismaEntryRepository(client), upsert };
};

describe("PrismaEntryRepository", () => {
  it("upserts by the habit and local-date composite key", async () => {
    const { repository, upsert } = setup();

    await repository.upsert({
      userId: "user-1",
      habitId: "habit-1",
      localDate: "2026-08-23",
      status: "done",
      source: "web",
      clientId: "client-1",
    });

    expect(upsert.mock.calls[0]?.[0].where).toEqual({
      habitId_localDate: {
        habitId: "habit-1",
        localDate: new Date("2026-08-23T00:00:00Z"),
      },
    });
  });

  it("sets a value by the habit and local-date composite key", async () => {
    const { repository, upsert } = setup();

    await repository.setValue({
      userId: "user-1",
      habitId: "habit-1",
      localDate: "2026-08-23",
      value: 3,
      status: "done",
      source: "web",
    });

    expect(upsert.mock.calls[0]?.[0].where).toEqual({
      habitId_localDate: {
        habitId: "habit-1",
        localDate: new Date("2026-08-23T00:00:00Z"),
      },
    });
  });
});
