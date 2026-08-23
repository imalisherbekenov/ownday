import { describe, expect, it, vi } from "vitest";
import {
  createServices,
  InMemoryEntryRepository,
  InMemoryHabitRepository,
  InMemoryReminderRepository,
  InMemoryTemplateRepository,
  InMemoryUserRepository,
} from "@ownday/services";
import {
  callback,
  habits,
  help,
  newHabit,
  settings,
  start,
  stats,
  text,
  today,
  type BotContext,
  type Session,
} from "./handlers.js";
const now = new Date("2024-01-02T12:00:00Z");
function setup() {
  const habits = new InMemoryHabitRepository(),
    entries = new InMemoryEntryRepository(),
    users = new InMemoryUserRepository(),
    reminders = new InMemoryReminderRepository(),
    templates = new InMemoryTemplateRepository(),
    services = createServices({ habits, entries, users, reminders, templates }),
    reply = vi.fn(async () => {}),
    answer = vi.fn(async () => {}),
    edit = vi.fn(async () => {}),
    session: Session = { lang: "en" },
    ctx = {
      from: { id: 42 },
      session,
      reply,
      answerCallbackQuery: answer,
      editMessageText: edit,
    } as BotContext;
  return {
    habits,
    entries,
    users,
    reminders,
    services,
    ctx,
    reply,
    answer,
    edit,
    deps: { services, users, reminders, now: () => now },
  };
}
async function onboard(s: ReturnType<typeof setup>) {
  const u = await s.services.ensureUserFromTelegram("42", {
    timezone: "UTC",
    dayStartHour: 4,
    locale: "en",
  });
  s.ctx.session.userId = u.id;
  return u;
}
describe("bot handlers", () => {
  it("shows an empty /today", async () => {
    const s = setup();
    await onboard(s);
    await today(s.ctx, s.deps);
    expect(s.reply).toHaveBeenCalledWith(
      "No habits are due today.",
      expect.objectContaining({ reply_markup: expect.any(Object) }),
    );
  });
  it("marks from a callback", async () => {
    const s = setup(),
      u = await onboard(s),
      h = await s.services.createHabit({
        userId: u.id,
        title: "Read",
        type: "binary",
        schedule: { kind: "daily" },
        validFrom: "2024-01-01",
      });
    s.ctx.callbackQuery = { data: `m:${h.id}:2024-01-02:d` };
    await callback(s.ctx, s.deps);
    expect(s.entries.entries.size).toBe(1);
    expect([...s.entries.entries.values()][0]?.status).toBe("done");
  });
  it("does not duplicate a double tap", async () => {
    const s = setup(),
      u = await onboard(s),
      h = await s.services.createHabit({
        userId: u.id,
        title: "Read",
        type: "binary",
        schedule: { kind: "daily" },
        validFrom: "2024-01-01",
      });
    s.ctx.callbackQuery = { data: `m:${h.id}:2024-01-02:d` };
    await callback(s.ctx, s.deps);
    await callback(s.ctx, s.deps);
    expect(s.entries.entries.size).toBe(1);
  });
  it("answers stale and invalid callbacks without throwing", async () => {
    const s = setup();
    await onboard(s);
    s.ctx.callbackQuery = { data: "not-valid" };
    await expect(callback(s.ctx, s.deps)).resolves.toBeUndefined();
    expect(s.answer).toHaveBeenCalledWith({
      text: "This button is outdated or the habit is no longer available.",
    });
  });

  it("increments counters repeatedly, floors at zero, and completes at the target", async () => {
    const s = setup();
    const user = await onboard(s);
    const habit = await s.services.createHabit({
      userId: user.id,
      title: "Water",
      type: "counter",
      targetValue: 3,
      unit: "glasses",
      schedule: { kind: "daily" },
      validFrom: "2024-01-01",
    });
    s.ctx.callbackQuery = { data: `m:${habit.id}:2024-01-02:-` };
    await callback(s.ctx, s.deps);
    expect([...s.entries.entries.values()][0]?.value).toBe(0);
    s.ctx.callbackQuery = { data: `m:${habit.id}:2024-01-02:+` };
    await callback(s.ctx, s.deps);
    await callback(s.ctx, s.deps);
    await callback(s.ctx, s.deps);
    const entry = [...s.entries.entries.values()][0];
    expect(entry?.value).toBe(3);
    expect(entry?.status).toBe("done");
    expect(s.entries.entries.size).toBe(1);
  });

  it("snoozes an owned reminder for one hour", async () => {
    const s = setup();
    const user = await onboard(s);
    const habit = await s.services.createHabit({
      userId: user.id,
      title: "Read",
      type: "binary",
      schedule: { kind: "daily" },
      validFrom: "2024-01-01",
    });
    const reminder = await s.reminders.create({
      userId: user.id,
      habitId: habit.id,
      localTime: "09:00",
      daysMask: 127,
      channel: "tg",
      enabled: true,
      nextFireAt: now,
    });
    s.ctx.callbackQuery = { data: `s:${reminder.id}` };
    await callback(s.ctx, s.deps);
    expect((await s.reminders.findById(reminder.id))?.nextFireAt.valueOf()).toBe(
      now.valueOf() + 60 * 60 * 1000,
    );
    expect(s.answer).toHaveBeenLastCalledWith({ text: "Reminder postponed for one hour." });
  });

  it("uses the user's shifted local date as validFrom", async () => {
    const s = setup();
    const user = await s.services.ensureUserFromTelegram("42", {
      timezone: "Asia/Tashkent",
      dayStartHour: 4,
      locale: "en",
    });
    s.ctx.session.userId = user.id;
    s.ctx.session.newHabit = {
      step: "reminder",
      title: "Walk",
      type: "binary",
      schedule: { kind: "daily" },
    };
    s.deps.now = () => new Date("2024-01-01T23:30:00Z");
    s.ctx.callbackQuery = { data: "new:r:no" };
    await callback(s.ctx, s.deps);
    const [habit] = await s.habits.listByUser(user.id);
    expect(habit?.scheduleVersions[0]?.validFrom).toBe("2024-01-02");
  });

  it("never sends a command response without reply_markup", async () => {
    for (const populated of [false, true]) {
      for (const handler of [today, habits, stats, settings, help] as const) {
        const s = setup();
        const user = await onboard(s);
        if (populated) {
          await s.services.createHabit({
            userId: user.id,
            title: "Read",
            type: "binary",
            schedule: { kind: "daily" },
            validFrom: "2023-12-01",
          });
        }
        await handler(s.ctx, s.deps);
        for (const call of s.reply.mock.calls) expect(call[1]?.reply_markup).toBeTruthy();
      }
      const s = setup();
      await onboard(s);
      await newHabit(s.ctx, s.deps);
      for (const call of s.reply.mock.calls) expect(call[1]?.reply_markup).toBeTruthy();
    }
  });

  it.each([
    ["Сегодня", "en"],
    ["Today", "ru"],
  ] as const)("routes the other language menu label %s", async (label, lang) => {
    const s = setup();
    const user = await onboard(s);
    await s.users.update(user.id, { locale: lang });
    s.ctx.session.lang = lang;
    s.ctx.message = { text: label };
    await text(s.ctx, s.deps);
    expect(s.reply).toHaveBeenCalled();
    expect(s.reply.mock.calls.at(-1)?.[0]).toContain(lang === "en" ? "No habits" : "привычек");
  });

  it("asks before leaving the wizard and does not use a menu label as a title", async () => {
    const s = setup();
    await onboard(s);
    s.ctx.session.newHabit = { step: "title" };
    s.ctx.message = { text: "Statistics" };
    await text(s.ctx, s.deps);
    expect(s.ctx.session.newHabit.title).toBeUndefined();
    expect(s.reply.mock.calls.at(-1)?.[0]).toBe("Interrupt habit creation?");
  });

  it("does not restart onboarding for a registered user", async () => {
    const s = setup();
    await onboard(s);
    await start(s.ctx, s.deps);
    expect(s.ctx.session.onboarding).toBeUndefined();
  });

  it.each([
    ["Read more", "Create a habit"],
    ["/wat", "I don't know that command"],
  ])("responds to arbitrary text %s", async (value, expected) => {
    const s = setup();
    await onboard(s);
    s.ctx.message = { text: value };
    await text(s.ctx, s.deps);
    expect(s.reply.mock.calls[0]?.[0]).toContain(expected);
  });

  it("redraws a completed habit and ignores message-is-not-modified", async () => {
    const s = setup();
    const user = await onboard(s);
    const habit = await s.services.createHabit({
      userId: user.id,
      title: "Read",
      type: "binary",
      schedule: { kind: "daily" },
      validFrom: "2024-01-01",
    });
    s.ctx.callbackQuery = { data: `m:${habit.id}:2024-01-02:d` };
    await callback(s.ctx, s.deps);
    expect(s.edit).toHaveBeenCalledWith(expect.stringContaining("✓"), expect.any(Object));
    s.edit.mockRejectedValueOnce(new Error("Bad Request: message is not modified"));
    s.ctx.callbackQuery = { data: `m:${habit.id}:2024-01-02:d` };
    await expect(callback(s.ctx, s.deps)).resolves.toBeUndefined();
  });
});
