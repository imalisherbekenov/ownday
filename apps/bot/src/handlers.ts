import { createHash } from "node:crypto";
import type { Schedule } from "@ownday/core";
import type { ReminderRepository, Services, User, UserRepository } from "@ownday/services";
import { t, type Lang } from "./i18n/index.js";

type NewHabitState = {
  step: "title" | "type" | "target" | "schedule" | "schedule_number" | "reminder";
  title?: string;
  type?: "binary" | "counter" | "duration";
  targetValue?: number;
  unit?: string;
  schedule?: Schedule;
  scheduleKind?: "times_per_week" | "interval_days";
  selectedDays?: number[];
};

export type Session = {
  lang: Lang;
  userId?: string;
  onboarding?: "language" | "timezone" | "dayStart";
  timezone?: string;
  newHabit?: NewHabitState;
};

type Button = { text: string; callback_data: string };
type Keyboard = { inline_keyboard: Button[][] };

export type BotContext = {
  from?: { id: number; language_code?: string };
  session: Session;
  message?: { text?: string };
  callbackQuery?: { data?: string };
  reply(text: string, options?: { reply_markup?: Keyboard }): Promise<unknown>;
  answerCallbackQuery(options?: { text?: string }): Promise<unknown>;
};

export type HandlerDeps = {
  services: Services;
  users: UserRepository;
  reminders: ReminderRepository;
  now?: () => Date;
};

const keyboard = (rows: Button[][]) => ({ reply_markup: { inline_keyboard: rows } });
const nowFor = (dependencies: HandlerDeps) => dependencies.now?.() ?? new Date();

const clientId = (source: string) => {
  const hash = createHash("sha256").update(source).digest("hex").slice(0, 32);
  return `${hash.slice(0, 8)}-${hash.slice(8, 12)}-4${hash.slice(13, 16)}-8${hash.slice(17, 20)}-${hash.slice(20, 32)}`;
};

async function currentUser(ctx: BotContext, dependencies: HandlerDeps) {
  if (ctx.session.userId) {
    const user = await dependencies.users.findById(ctx.session.userId);
    if (user) return user;
  }
  if (!ctx.from) throw new Error("NO_USER");
  const found = await dependencies.users.findIdentity("telegram", String(ctx.from.id));
  if (!found) return null;
  ctx.session.userId = found.user.id;
  ctx.session.lang = found.user.locale;
  return found.user;
}

export async function start(ctx: BotContext) {
  ctx.session.onboarding = "language";
  await ctx.reply(
    t(ctx.session.lang, "welcome"),
    keyboard([
      [
        { text: "Русский", callback_data: "on:l:ru" },
        { text: "English", callback_data: "on:l:en" },
      ],
    ]),
  );
}

export async function today(ctx: BotContext, dependencies: HandlerDeps) {
  const user = await currentUser(ctx, dependencies);
  if (!user) return start(ctx);
  const rows = await dependencies.services.listHabitsForToday(user.id, nowFor(dependencies));
  if (!rows.length) return void (await ctx.reply(t(user.locale, "todayEmpty")));

  const buttons = rows.map(({ habit, localDate }) => {
    const prefix = `m:${habit.id}:${localDate}:`;
    if (habit.type !== "binary") {
      return [
        { text: t(user.locale, "minus"), callback_data: `${prefix}-` },
        { text: t(user.locale, "plus"), callback_data: `${prefix}+` },
        { text: t(user.locale, "skip"), callback_data: `${prefix}s` },
      ];
    }
    return [
      { text: t(user.locale, "done"), callback_data: `${prefix}d` },
      { text: t(user.locale, "skip"), callback_data: `${prefix}s` },
    ];
  });
  const lines = rows.map(
    ({ habit, streak }) => `${habit.title}${streak.current ? ` · ${streak.current}` : ""}`,
  );
  await ctx.reply([t(user.locale, "todayTitle"), ...lines].join("\n"), keyboard(buttons));
}

export async function habits(ctx: BotContext, dependencies: HandlerDeps) {
  const user = await currentUser(ctx, dependencies);
  if (!user) return start(ctx);
  const all = await dependencies.services.listHabits(user.id);
  if (!all.length) return void (await ctx.reply(t(user.locale, "habitsEmpty")));
  await ctx.reply(
    [t(user.locale, "habitsTitle"), ...all.map((habit) => habit.title)].join("\n"),
    keyboard(
      all.map((habit) => [
        {
          text: `${t(user.locale, "archive")}: ${habit.title}`,
          callback_data: `a:${habit.id}`,
        },
      ]),
    ),
  );
}

export async function stats(ctx: BotContext, dependencies: HandlerDeps) {
  const user = await currentUser(ctx, dependencies);
  if (!user) return start(ctx);
  const summary = await dependencies.services.getUserSummary(user.id, {
    days: 7,
    now: nowFor(dependencies),
  });
  await ctx.reply(
    t(user.locale, "stats", {
      done: summary.done,
      due: summary.due,
      rate: Math.round((summary.completionRate ?? 0) * 100),
    }),
  );
}

export async function settings(ctx: BotContext, dependencies: HandlerDeps) {
  const user = await currentUser(ctx, dependencies);
  if (!user) return start(ctx);
  const reminders = await dependencies.services.listReminders(user.id);
  await ctx.reply(
    t(user.locale, "settings", {
      timezone: user.timezone,
      dayStart: user.dayStartHour,
      locale: user.locale,
      reminders: reminders.filter((reminder) => reminder.enabled).length,
    }),
    keyboard([
      [
        { text: "RU", callback_data: "set:l:ru" },
        { text: "EN", callback_data: "set:l:en" },
      ],
      [
        { text: "UTC", callback_data: "set:z:UTC" },
        { text: "Asia/Tashkent", callback_data: "set:z:Asia/Tashkent" },
      ],
      [
        { text: "04:00", callback_data: "set:d:4" },
        { text: "00:00", callback_data: "set:d:0" },
      ],
    ]),
  );
}

export async function newHabit(ctx: BotContext) {
  ctx.session.newHabit = { step: "title" };
  await ctx.reply(t(ctx.session.lang, "newTitle"));
}

async function showSchedulePrompt(ctx: BotContext) {
  await ctx.reply(
    t(ctx.session.lang, "newSchedule"),
    keyboard([
      [{ text: t(ctx.session.lang, "daily"), callback_data: "new:s:daily" }],
      [{ text: t(ctx.session.lang, "specificDays"), callback_data: "new:s:days" }],
      [{ text: t(ctx.session.lang, "timesPerWeek"), callback_data: "new:s:week" }],
      [{ text: t(ctx.session.lang, "intervalDays"), callback_data: "new:s:interval" }],
    ]),
  );
}

async function showReminderPrompt(ctx: BotContext) {
  await ctx.reply(
    t(ctx.session.lang, "newReminder"),
    keyboard([
      [{ text: t(ctx.session.lang, "noReminder"), callback_data: "new:r:no" }],
      ["08:00", "09:00", "12:00"].map((time) => ({ text: time, callback_data: `new:r:${time}` })),
      ["18:00", "21:00"].map((time) => ({ text: time, callback_data: `new:r:${time}` })),
    ]),
  );
}

async function handleNewHabitText(ctx: BotContext, value: string) {
  const state = ctx.session.newHabit;
  if (!state) return false;
  if (state.step === "title") {
    state.title = value;
    state.step = "type";
    await ctx.reply(
      t(ctx.session.lang, "newType"),
      keyboard([
        [
          { text: t(ctx.session.lang, "binary"), callback_data: "new:t:binary" },
          { text: t(ctx.session.lang, "counter"), callback_data: "new:t:counter" },
          { text: t(ctx.session.lang, "duration"), callback_data: "new:t:duration" },
        ],
      ]),
    );
    return true;
  }
  if (state.step === "target") {
    const [rawTarget, ...unitParts] = value.split(/\s+/);
    const target = Number(rawTarget);
    if (!Number.isFinite(target) || target <= 0 || !unitParts.length) {
      await ctx.reply(t(ctx.session.lang, "invalidInput"));
      return true;
    }
    state.targetValue = target;
    state.unit = unitParts.join(" ");
    state.step = "schedule";
    await showSchedulePrompt(ctx);
    return true;
  }
  if (state.step === "schedule_number") {
    const amount = Number(value);
    if (!Number.isInteger(amount) || amount <= 0) {
      await ctx.reply(t(ctx.session.lang, "invalidInput"));
      return true;
    }
    state.schedule =
      state.scheduleKind === "times_per_week"
        ? { kind: "times_per_week", target: Math.min(amount, 7) }
        : { kind: "interval_days", every: amount, anchor: "" };
    state.step = "reminder";
    await showReminderPrompt(ctx);
    return true;
  }
  return false;
}

export async function text(ctx: BotContext, dependencies: HandlerDeps) {
  const value = ctx.message?.text?.trim();
  if (!value) return;
  if (ctx.session.onboarding === "timezone") {
    try {
      new Intl.DateTimeFormat("en", { timeZone: value });
      ctx.session.timezone = value;
      ctx.session.onboarding = "dayStart";
      await ctx.reply(
        t(ctx.session.lang, "chooseDayStart"),
        keyboard([
          [
            { text: "4", callback_data: "on:d:4" },
            { text: "0", callback_data: "on:d:0" },
            { text: "6", callback_data: "on:d:6" },
          ],
        ]),
      );
    } catch {
      await ctx.reply(t(ctx.session.lang, "invalidInput"));
    }
    return;
  }
  await handleNewHabitText(ctx, value);
  void dependencies;
}

async function handleOnboarding(ctx: BotContext, dependencies: HandlerDeps, data: string) {
  if (data.startsWith("on:l:")) {
    ctx.session.lang = data.slice(5) as Lang;
    ctx.session.onboarding = "timezone";
    await ctx.answerCallbackQuery();
    await ctx.reply(
      t(ctx.session.lang, "chooseTimezone"),
      keyboard([
        [
          { text: "UTC", callback_data: "on:z:UTC" },
          { text: "Asia/Tashkent", callback_data: "on:z:Asia/Tashkent" },
        ],
        [
          { text: "Europe/London", callback_data: "on:z:Europe/London" },
          { text: "America/New_York", callback_data: "on:z:America/New_York" },
        ],
      ]),
    );
    return true;
  }
  if (data.startsWith("on:z:")) {
    ctx.session.timezone = data.slice(5);
    ctx.session.onboarding = "dayStart";
    await ctx.answerCallbackQuery();
    await ctx.reply(
      t(ctx.session.lang, "chooseDayStart"),
      keyboard([
        [
          { text: "4", callback_data: "on:d:4" },
          { text: "0", callback_data: "on:d:0" },
          { text: "6", callback_data: "on:d:6" },
        ],
      ]),
    );
    return true;
  }
  if (data.startsWith("on:d:") && ctx.from) {
    const user = await dependencies.services.ensureUserFromTelegram(String(ctx.from.id), {
      timezone: ctx.session.timezone ?? "UTC",
      dayStartHour: Number(data.slice(5)),
      locale: ctx.session.lang,
    });
    ctx.session.userId = user.id;
    delete ctx.session.onboarding;
    await ctx.answerCallbackQuery();
    await ctx.reply(t(ctx.session.lang, "onboarded"));
    return true;
  }
  return false;
}

async function handleMark(ctx: BotContext, dependencies: HandlerDeps, user: User, data: string) {
  if (!data.startsWith("m:")) return false;
  const [, habitId, localDate, action] = data.split(":");
  if (!habitId || !localDate || !action) throw new Error("STALE");
  const rows = await dependencies.services.listHabitsForToday(user.id, nowFor(dependencies));
  const row = rows.find(
    (candidate) => candidate.habit.id === habitId && candidate.localDate === localDate,
  );
  if (!row) throw new Error("STALE");

  if ((action === "+" || action === "-") && row.habit.type !== "binary") {
    const currentValue = row.entry?.value ?? 0;
    const value = action === "+" ? currentValue + 1 : Math.max(0, currentValue - 1);
    await dependencies.services.setEntryValue({
      userId: user.id,
      habitId,
      localDate,
      value,
      source: "tg",
    });
  } else {
    await dependencies.services.markEntry({
      userId: user.id,
      habitId,
      localDate,
      status: action === "s" ? "skip" : "done",
      source: "tg",
      clientId: clientId(`${habitId}:${localDate}:${action}`),
    });
  }
  await ctx.answerCallbackQuery({ text: t(user.locale, "marked") });
  return true;
}

async function handleSnooze(ctx: BotContext, dependencies: HandlerDeps, user: User, data: string) {
  if (!data.startsWith("s:")) return false;
  const reminderId = data.slice(2);
  if (!reminderId) throw new Error("STALE");
  const until = new Date(nowFor(dependencies).valueOf() + 60 * 60 * 1000);
  await dependencies.services.snoozeReminder(reminderId, user.id, until);
  await ctx.answerCallbackQuery({ text: t(user.locale, "snoozed") });
  return true;
}

async function handleArchive(ctx: BotContext, dependencies: HandlerDeps, user: User, data: string) {
  if (!data.startsWith("a:")) return false;
  if (!(await dependencies.services.archiveHabit(data.slice(2), user.id))) throw new Error("STALE");
  await ctx.answerCallbackQuery({ text: t(user.locale, "archived") });
  return true;
}

async function handleSettings(
  ctx: BotContext,
  dependencies: HandlerDeps,
  user: User,
  data: string,
) {
  if (!data.startsWith("set:")) return false;
  const [, kind, value] = data.split(":");
  if (kind === "l" && (value === "ru" || value === "en")) {
    await dependencies.users.update(user.id, { locale: value });
    ctx.session.lang = value;
  } else if (kind === "z" && value) {
    await dependencies.users.update(user.id, { timezone: value });
  } else if (kind === "d" && value) {
    await dependencies.users.update(user.id, { dayStartHour: Number(value) });
  } else {
    throw new Error("STALE");
  }
  await ctx.answerCallbackQuery();
  return true;
}

async function handleNewType(ctx: BotContext, data: string) {
  if (!data.startsWith("new:t:")) return false;
  const state = ctx.session.newHabit;
  const type = data.slice(6);
  if (!state || !["binary", "counter", "duration"].includes(type)) throw new Error("STALE");
  state.type = type as "binary" | "counter" | "duration";
  if (type === "binary") {
    state.step = "schedule";
    await showSchedulePrompt(ctx);
  } else {
    state.step = "target";
    await ctx.reply(t(ctx.session.lang, "newTarget"));
  }
  await ctx.answerCallbackQuery();
  return true;
}

async function handleNewSchedule(ctx: BotContext, data: string) {
  if (!data.startsWith("new:s:")) return false;
  const state = ctx.session.newHabit;
  if (!state) throw new Error("STALE");
  const kind = data.slice(6);
  if (kind === "daily") {
    state.schedule = { kind: "daily" };
  } else if (kind === "days") {
    state.selectedDays = [];
    await ctx.answerCallbackQuery();
    await ctx.reply(
      t(ctx.session.lang, "chooseDays"),
      keyboard([
        [1, 2, 3, 4, 5, 6, 7].map((day) => ({ text: String(day), callback_data: `new:d:${day}` })),
        [{ text: t(ctx.session.lang, "confirm"), callback_data: "new:d:ok" }],
      ]),
    );
    return true;
  } else if (kind === "week" || kind === "interval") {
    state.scheduleKind = kind === "week" ? "times_per_week" : "interval_days";
    state.step = "schedule_number";
    await ctx.answerCallbackQuery();
    await ctx.reply(t(ctx.session.lang, kind === "week" ? "enterTimes" : "enterInterval"));
    return true;
  } else {
    throw new Error("STALE");
  }
  state.step = "reminder";
  await ctx.answerCallbackQuery();
  await showReminderPrompt(ctx);
  return true;
}

async function handleNewDays(ctx: BotContext, data: string) {
  if (!data.startsWith("new:d:")) return false;
  const state = ctx.session.newHabit;
  if (!state?.selectedDays) throw new Error("STALE");
  const value = data.slice(6);
  if (value === "ok") {
    if (!state.selectedDays.length) throw new Error("STALE");
    state.schedule = { kind: "days_of_week", days: [...state.selectedDays].sort() };
    state.step = "reminder";
    await ctx.answerCallbackQuery();
    await showReminderPrompt(ctx);
    return true;
  }
  const day = Number(value);
  if (!Number.isInteger(day) || day < 1 || day > 7) throw new Error("STALE");
  state.selectedDays = state.selectedDays.includes(day)
    ? state.selectedDays.filter((candidate) => candidate !== day)
    : [...state.selectedDays, day];
  await ctx.answerCallbackQuery({ text: state.selectedDays.join(", ") });
  return true;
}

async function handleNewReminder(
  ctx: BotContext,
  dependencies: HandlerDeps,
  user: User,
  data: string,
) {
  if (!data.startsWith("new:r:")) return false;
  const state = ctx.session.newHabit;
  if (!state?.title || !state.type || !state.schedule) throw new Error("STALE");
  const now = nowFor(dependencies);
  const validFrom = await dependencies.services.localDateForUser(user.id, now);
  if (state.schedule.kind === "interval_days") state.schedule.anchor = validFrom;
  const habit = await dependencies.services.createHabit({
    userId: user.id,
    title: state.title,
    type: state.type,
    targetValue: state.targetValue,
    unit: state.unit,
    schedule: state.schedule,
    validFrom,
  });
  const time = data.slice(6);
  if (time !== "no") {
    if (!/^\d{2}:\d{2}$/.test(time)) throw new Error("STALE");
    await dependencies.services.createReminder({
      userId: user.id,
      habitId: habit.id,
      localTime: time,
      daysMask: 127,
      now,
    });
  }
  delete ctx.session.newHabit;
  await ctx.answerCallbackQuery();
  await ctx.reply(t(user.locale, "newCreated"));
  return true;
}

export async function callback(ctx: BotContext, dependencies: HandlerDeps) {
  const data = ctx.callbackQuery?.data ?? "";
  try {
    if (await handleOnboarding(ctx, dependencies, data)) return;
    const user = await currentUser(ctx, dependencies);
    if (!user) throw new Error("STALE");
    if (await handleMark(ctx, dependencies, user, data)) return;
    if (await handleSnooze(ctx, dependencies, user, data)) return;
    if (await handleArchive(ctx, dependencies, user, data)) return;
    if (await handleSettings(ctx, dependencies, user, data)) return;
    if (await handleNewType(ctx, data)) return;
    if (await handleNewSchedule(ctx, data)) return;
    if (await handleNewDays(ctx, data)) return;
    if (await handleNewReminder(ctx, dependencies, user, data)) return;
    throw new Error("STALE");
  } catch {
    await ctx.answerCallbackQuery({ text: t(ctx.session.lang, "stale") });
  }
}
