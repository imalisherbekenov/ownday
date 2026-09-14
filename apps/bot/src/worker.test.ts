import { describe, it, expect, vi } from "vitest";
import { deliverOne } from "./worker.js";
import type { Bot } from "grammy";
import type { HandlerDeps } from "./handlers.js";
import type { ReminderDeliveryQueue } from "@ownday/services";

const now = new Date("2026-09-13T12:00:00Z");
function setup(status?: "done" | "skip", date = "2026-09-13") {
  const sendMessage = vi.fn().mockResolvedValue({ message_id: 1 });
  const queue = {
    claim: vi
      .fn()
      .mockResolvedValue({
        id: "job",
        leaseToken: "lease",
        localDate: date,
        reminder: {
          id: "reminder",
          habitId: "habit",
          userId: "user",
          enabled: true,
          user: { timezone: "UTC", dayStartHour: 4, locale: "ru" },
        },
      }),
    complete: vi.fn().mockResolvedValue(true),
    fail: vi.fn().mockResolvedValue(true),
  };
  const deps = {
    users: { findIdentityForUser: vi.fn().mockResolvedValue({ externalId: "123" }) },
    services: {
      listHabitsForToday: vi
        .fn()
        .mockResolvedValue([
          {
            habit: { id: "habit", title: "Read" },
            localDate: date,
            entry: status ? { status } : null,
          },
        ]),
    },
  };
  return {
    sendMessage,
    queue,
    run: () =>
      deliverOne(
        { api: { sendMessage } } as unknown as Bot,
        deps as unknown as HandlerDeps,
        queue as unknown as ReminderDeliveryQueue,
        now,
      ),
  };
}
describe("reminder delivery", () => {
  it.each(["done", "skip"] as const)("does not notify an already %s habit", async (status) => {
    const test = setup(status);
    await test.run();
    expect(test.sendMessage).not.toHaveBeenCalled();
    expect(test.queue.complete).toHaveBeenCalledWith("job", "lease", "skipped", expect.any(Date));
  });
  it("does not deliver yesterday's backlog today", async () => {
    const test = setup(undefined, "2026-09-12");
    await test.run();
    expect(test.sendMessage).not.toHaveBeenCalled();
    expect(test.queue.complete).toHaveBeenCalledWith("job", "lease", "skipped", expect.any(Date));
  });
  it("acknowledges only after Telegram confirms delivery", async () => {
    const test = setup();
    let confirm!: () => void;
    test.sendMessage.mockImplementation(
      () =>
        new Promise<void>((resolve) => {
          confirm = resolve;
        }),
    );
    const running = test.run();
    await vi.waitFor(() => expect(test.sendMessage).toHaveBeenCalledOnce());
    expect(test.queue.complete).not.toHaveBeenCalled();
    confirm();
    await running;
    expect(test.queue.complete).toHaveBeenCalledWith("job", "lease", "sent", expect.any(Date));
  });
  it("honors Telegram retry_after without logging message content", async () => {
    const test = setup();
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      test.sendMessage.mockRejectedValue({
        error_code: 429,
        parameters: { retry_after: 90 },
        description: "private details",
      });
      await test.run();
      expect(test.queue.complete).not.toHaveBeenCalled();
      expect(test.queue.fail).toHaveBeenCalledWith(
        "job",
        "lease",
        expect.any(Date),
        "TELEGRAM_429",
        90,
        false,
      );
      expect(JSON.stringify(log.mock.calls)).not.toContain("private details");
    } finally {
      log.mockRestore();
    }
  });
});
