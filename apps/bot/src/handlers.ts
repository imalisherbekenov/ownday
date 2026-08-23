import { createHash } from "node:crypto";
import type { Schedule } from "@ownday/core";
import type { ReminderRepository, Services, User, UserRepository } from "@ownday/services";
import {
  backTo,
  mainMenu,
  todayKeyboard,
  type InlineButton,
  type InlineKeyboard,
  type ReplyKeyboard,
} from "./keyboards.js";
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
  pendingMenu?: MenuTarget;
  pendingTitle?: string;
};

type ReplyMarkup = InlineKeyboard | ReplyKeyboard;
export type BotContext = {
  from?: { id: number; language_code?: string };
  chat?: { id: number };
  session: Session;
  message?: { text?: string };
  callbackQuery?: { data?: string; message?: { message_id?: number } };
  reply(
    text: string,
    options: { reply_markup: ReplyMarkup; parse_mode?: "HTML" },
  ): Promise<unknown>;
  answerCallbackQuery(options?: { text?: string }): Promise<unknown>;
  editMessageText?(text: string, options: { reply_markup: InlineKeyboard }): Promise<unknown>;
};

export type HandlerDeps = {
  services: Services;
  users: UserRepository;
  reminders: ReminderRepository;
  now?: () => Date;
};

type MenuTarget = "today" | "new" | "habits" | "stats" | "settings";
const inline = (rows: InlineButton[][]) => ({ reply_markup: { inline_keyboard: rows } });
const replyMenu = (lang: Lang) => ({ reply_markup: mainMenu(lang) });
const nowFor = (dependencies: HandlerDeps) => dependencies.now?.() ?? new Date();
const detectedLang = (code?: string): Lang => (code?.toLowerCase().startsWith("en") ? "en" : "ru");

const clientId = (source: string) => {
  const hash = createHash("sha256").update(source).digest("hex").slice(0, 32);
  return `${hash.slice(0, 8)}-${hash.slice(8, 12)}-4${hash.slice(13, 16)}-8${hash.slice(17, 20)}-${hash.slice(20, 32)}`;
};

async function currentUser(ctx: BotContext, dependencies: HandlerDeps) {
  if (ctx.session.userId) {
    const user = await dependencies.users.findById(ctx.session.userId);
    if (user) return user;
  }
  if (!ctx.from) return null;
  const found = await dependencies.users.findIdentity("telegram", String(ctx.from.id));
  if (!found) return null;
  ctx.session.userId = found.user.id;
  ctx.session.lang = found.user.locale;
  return found.user;
}

export async function langFor(ctx: BotContext, dependencies: HandlerDeps): Promise<Lang> {
  const user = await currentUser(ctx, dependencies);
  return user?.locale ?? ctx.session.lang ?? detectedLang(ctx.from?.language_code);
}

const templateKeyboard = async (lang: Lang, dependencies: HandlerDeps, all = false) => {
  const templates = await dependencies.services.listTemplates(lang);
  const visible = templates.slice(0, all ? 40 : 5);
  const rows = visible.map((template) => [
    { text: `${template.icon} ${template.title}`, callback_data: `tpl:${template.id}` },
  ]);
  rows.push([{ text: t(lang, "customHabit"), callback_data: "new:custom" }]);
  if (!all) rows.push([{ text: t(lang, "allTemplates"), callback_data: "tpl:all" }]);
  return { inline_keyboard: rows } satisfies InlineKeyboard;
};

const renderToday = async (user: User, dependencies: HandlerDeps) => {
  const rows = await dependencies.services.listHabitsForToday(user.id, nowFor(dependencies));
  const lines = rows.map(({ habit, entry, streak }) => {
    if (habit.type !== "binary") {
      return t(user.locale, entry?.status === "done" ? "progressDone" : "progressValue", {
        title: habit.title,
        value: entry?.value ?? 0,
        target: habit.targetValue ?? 0,
        unit: habit.unit ?? "",
      });
    }
    const title = t(user.locale, entry?.status === "done" ? "progressDone" : "progressOpen", {
      title: habit.title,
    });
    return `${title}${streak.current ? ` · ${streak.current}` : ""}`;
  });
  return {
    rows,
    text: rows.length
      ? [t(user.locale, "todayTitle"), ...lines].join("\n")
      : t(user.locale, "todayEmpty"),
    markup: rows.length
      ? todayKeyboard(user.locale, rows)
      : await templateKeyboard(user.locale, dependencies),
  };
};

export async function start(ctx: BotContext, dependencies: HandlerDeps) {
  const user = await currentUser(ctx, dependencies);
  if (user) {
    delete ctx.session.onboarding;
    const summary = await dependencies.services.getUserSummary(user.id, {
      days: 1,
      now: nowFor(dependencies),
    });
    await ctx.reply(
      t(user.locale, "home", { done: summary.done, due: summary.due }),
      replyMenu(user.locale),
    );
    const view = await renderToday(user, dependencies);
    await ctx.reply(view.text, { reply_markup: view.markup });
    return;
  }
  ctx.session.lang = detectedLang(ctx.from?.language_code);
  ctx.session.onboarding = "language";
  await ctx.reply(
    t(ctx.session.lang, "welcome"),
    inline([
      [
        { text: "Русский", callback_data: "on:l:ru" },
        { text: "English", callback_data: "on:l:en" },
      ],
    ]),
  );
}

export async function today(ctx: BotContext, dependencies: HandlerDeps) {
  const user = await currentUser(ctx, dependencies);
  if (!user) return start(ctx, dependencies);
  const view = await renderToday(user, dependencies);
  await ctx.reply(view.text, { reply_markup: view.markup });
}

export async function habits(ctx: BotContext, dependencies: HandlerDeps) {
  const user = await currentUser(ctx, dependencies);
  if (!user) return start(ctx, dependencies);
  const all = await dependencies.services.listHabits(user.id);
  if (!all.length) {
    await ctx.reply(t(user.locale, "habitsEmpty"), {
      reply_markup: await templateKeyboard(user.locale, dependencies),
    });
    return;
  }
  await ctx.reply(
    [t(user.locale, "habitsTitle"), ...all.map((habit) => habit.title)].join("\n"),
    inline(
      all.map((habit) => [
        { text: `${t(user.locale, "archive")}: ${habit.title}`, callback_data: `a:${habit.id}` },
      ]),
    ),
  );
}

export async function stats(ctx: BotContext, dependencies: HandlerDeps, days = 7) {
  const user = await currentUser(ctx, dependencies);
  if (!user) return start(ctx, dependencies);
  const summary = await dependencies.services.getUserSummary(user.id, {
    days,
    now: nowFor(dependencies),
  });
  await ctx.reply(
    t(user.locale, "stats", {
      done: summary.done,
      due: summary.due,
      rate: Math.round((summary.completionRate ?? 0) * 100),
    }),
    inline([
      [
        { text: t(user.locale, "stats7"), callback_data: "stats:7" },
        { text: t(user.locale, "stats30"), callback_data: "stats:30" },
        { text: t(user.locale, "statsToday"), callback_data: "stats:1" },
      ],
    ]),
  );
}

export async function settings(ctx: BotContext, dependencies: HandlerDeps) {
  const user = await currentUser(ctx, dependencies);
  if (!user) return start(ctx, dependencies);
  const reminders = await dependencies.services.listReminders(user.id);
  await ctx.reply(
    t(user.locale, "settings", {
      timezone: user.timezone,
      dayStart: user.dayStartHour,
      locale: user.locale,
      reminders: reminders.filter((x) => x.enabled).length,
    }),
    inline([
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

export async function help(ctx: BotContext, dependencies: HandlerDeps) {
  const lang = await langFor(ctx, dependencies);
  await ctx.reply(t(lang, "helpFull"), { reply_markup: backTo(lang, "today") });
}

export async function newHabit(ctx: BotContext, dependencies?: HandlerDeps) {
  const lang = dependencies ? await langFor(ctx, dependencies) : ctx.session.lang;
  ctx.session.newHabit = { step: "title" };
  await ctx.reply(
    t(lang, "newTitle"),
    inline([
      [
        { text: t(lang, "cancel"), callback_data: "new:cancel" },
        { text: t(lang, "chooseTemplate"), callback_data: "tpl:all" },
      ],
    ]),
  );
}

async function showSchedulePrompt(ctx: BotContext) {
  const lang = ctx.session.lang;
  await ctx.reply(
    t(lang, "newSchedule"),
    inline([
      [{ text: t(lang, "daily"), callback_data: "new:s:daily" }],
      [{ text: t(lang, "specificDays"), callback_data: "new:s:days" }],
      [{ text: t(lang, "timesPerWeek"), callback_data: "new:s:week" }],
      [{ text: t(lang, "intervalDays"), callback_data: "new:s:interval" }],
      [{ text: t(lang, "cancel"), callback_data: "new:cancel" }],
    ]),
  );
}

async function showTargetPrompt(ctx: BotContext, error = false) {
  const lang = ctx.session.lang;
  await ctx.reply(
    t(lang, error ? "invalidInput" : "newTarget"),
    inline([
      [
        { text: t(lang, "presetGlasses"), callback_data: "new:v:8:glasses" },
        { text: t(lang, "presetSteps"), callback_data: "new:v:10000:steps" },
      ],
      [{ text: t(lang, "presetMinutes"), callback_data: "new:v:30:minutes" }],
      [{ text: t(lang, "cancel"), callback_data: "new:cancel" }],
    ]),
  );
}

async function showNumberPrompt(ctx: BotContext, error = false) {
  const state = ctx.session.newHabit;
  const lang = ctx.session.lang;
  const week = state?.scheduleKind === "times_per_week";
  await ctx.reply(
    t(lang, error ? "invalidInput" : week ? "enterTimes" : "enterInterval"),
    inline([
      (week ? [1, 2, 3, 4, 5, 6, 7] : [2, 3, 5, 7]).map((n) => ({
        text: String(n),
        callback_data: `new:n:${n}`,
      })),
      [{ text: t(lang, "cancel"), callback_data: "new:cancel" }],
    ]),
  );
}

async function showReminderPrompt(ctx: BotContext) {
  const lang = ctx.session.lang;
  await ctx.reply(
    t(lang, "newReminder"),
    inline([
      [{ text: t(lang, "noReminder"), callback_data: "new:r:no" }],
      ["08:00", "09:00", "12:00"].map((time) => ({ text: time, callback_data: `new:r:${time}` })),
      ["18:00", "21:00"].map((time) => ({ text: time, callback_data: `new:r:${time}` })),
      [{ text: t(lang, "cancel"), callback_data: "new:cancel" }],
    ]),
  );
}

async function handleNewHabitText(ctx: BotContext, value: string) {
  const state = ctx.session.newHabit;
  if (!state) return false;
  if (state.step === "title") {
    state.title = value.slice(0, 60);
    state.step = "type";
    await ctx.reply(
      t(ctx.session.lang, "newType"),
      inline([
        [
          { text: t(ctx.session.lang, "binary"), callback_data: "new:t:binary" },
          { text: t(ctx.session.lang, "counter"), callback_data: "new:t:counter" },
          { text: t(ctx.session.lang, "duration"), callback_data: "new:t:duration" },
        ],
        [{ text: t(ctx.session.lang, "cancel"), callback_data: "new:cancel" }],
      ]),
    );
    return true;
  }
  if (state.step === "target") {
    const [rawTarget, ...unitParts] = value.split(/\s+/);
    const target = Number(rawTarget);
    if (!Number.isFinite(target) || target <= 0 || !unitParts.length) {
      await showTargetPrompt(ctx, true);
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
      await showNumberPrompt(ctx, true);
      return true;
    }
    applyScheduleNumber(state, amount);
    await showReminderPrompt(ctx);
    return true;
  }
  return false;
}

function applyScheduleNumber(state: NewHabitState, amount: number) {
  state.schedule =
    state.scheduleKind === "times_per_week"
      ? { kind: "times_per_week", target: Math.min(amount, 7) }
      : { kind: "interval_days", every: amount, anchor: "" };
  state.step = "reminder";
}

const menuLabels = (): Map<string, MenuTarget> =>
  new Map([
    [t("ru", "menuToday"), "today"],
    [t("en", "menuToday"), "today"],
    [t("ru", "menuNew"), "new"],
    [t("en", "menuNew"), "new"],
    [t("ru", "menuHabits"), "habits"],
    [t("en", "menuHabits"), "habits"],
    [t("ru", "menuStats"), "stats"],
    [t("en", "menuStats"), "stats"],
    [t("ru", "menuSettings"), "settings"],
    [t("en", "menuSettings"), "settings"],
  ]);

async function routeMenu(ctx: BotContext, dependencies: HandlerDeps, target: MenuTarget) {
  if (target === "today") return today(ctx, dependencies);
  if (target === "new") return newHabit(ctx, dependencies);
  if (target === "habits") return habits(ctx, dependencies);
  if (target === "stats") return stats(ctx, dependencies);
  return settings(ctx, dependencies);
}

export async function text(ctx: BotContext, dependencies: HandlerDeps) {
  const value = ctx.message?.text?.trim();
  if (!value) return;
  const lang = await langFor(ctx, dependencies);
  const target = menuLabels().get(value);
  if (target) {
    if (ctx.session.newHabit) {
      ctx.session.pendingMenu = target;
      await ctx.reply(
        t(lang, "interruptQuestion"),
        inline([
          [
            { text: t(lang, "interruptYes"), callback_data: "new:interrupt" },
            { text: t(lang, "interruptNo"), callback_data: "new:continue" },
          ],
        ]),
      );
      return;
    }
    return routeMenu(ctx, dependencies, target);
  }
  if (ctx.session.onboarding === "timezone") {
    try {
      new Intl.DateTimeFormat("en", { timeZone: value });
      ctx.session.timezone = value;
      ctx.session.onboarding = "dayStart";
      await ctx.reply(
        t(lang, "chooseDayStart"),
        inline([
          [
            { text: "4", callback_data: "on:d:4" },
            { text: "0", callback_data: "on:d:0" },
            { text: "6", callback_data: "on:d:6" },
          ],
        ]),
      );
    } catch {
      await ctx.reply(
        t(lang, "invalidInput"),
        inline([
          [
            { text: "UTC", callback_data: "on:z:UTC" },
            { text: "Asia/Tashkent", callback_data: "on:z:Asia/Tashkent" },
          ],
        ]),
      );
    }
    return;
  }
  if (await handleNewHabitText(ctx, value)) return;
  if (value.startsWith("/")) {
    await ctx.reply(
      t(lang, "unknownCommand"),
      inline([[{ text: t(lang, "helpButton"), callback_data: "go:help" }]]),
    );
    await ctx.reply(t(lang, "menuPlaceholder"), replyMenu(lang));
    return;
  }
  const title = value
    .slice(0, 60)
    .replace(
      /[&<>"']/g,
      (x) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[x]!,
    );
  ctx.session.pendingTitle = value.slice(0, 60);
  await ctx.reply(t(lang, "createQuestion", { title }), {
    ...inline([
      [
        { text: t(lang, "createNow"), callback_data: "quick:create" },
        { text: t(lang, "findTemplates"), callback_data: "tpl:all" },
        { text: t(lang, "cancel"), callback_data: "quick:cancel" },
      ],
    ]),
    parse_mode: "HTML",
  });
}

async function handleOnboarding(ctx: BotContext, dependencies: HandlerDeps, data: string) {
  if (data.startsWith("on:l:")) {
    ctx.session.lang = data.slice(5) as Lang;
    ctx.session.onboarding = "timezone";
    await ctx.answerCallbackQuery();
    await ctx.reply(
      t(ctx.session.lang, "chooseTimezone"),
      inline([
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
      inline([
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
    await ctx.reply(t(ctx.session.lang, "onboarded"), replyMenu(ctx.session.lang));
    await ctx.reply(t(ctx.session.lang, "templatesTitle"), {
      reply_markup: await templateKeyboard(ctx.session.lang, dependencies),
    });
    return true;
  }
  return false;
}

const telegramMessage = (error: unknown) =>
  String(
    (error as { description?: string; message?: string })?.description ??
      (error as { message?: string })?.message ??
      error,
  ).toLowerCase();
async function refreshCallbackMessage(
  ctx: BotContext,
  user: User,
  dependencies: HandlerDeps,
  fallbackText?: string,
  fallbackMarkup?: InlineKeyboard,
) {
  const view =
    fallbackText && fallbackMarkup
      ? { text: fallbackText, markup: fallbackMarkup }
      : await renderToday(user, dependencies);
  try {
    if (!ctx.editMessageText) throw new Error("message can't be edited");
    await ctx.editMessageText(view.text, { reply_markup: view.markup });
  } catch (error) {
    const message = telegramMessage(error);
    if (message.includes("message is not modified")) return;
    if (
      message.includes("can't be edited") ||
      message.includes("cannot be edited") ||
      message.includes("message to edit not found")
    ) {
      await ctx.reply(`${t(user.locale, "editFallback")}\n${view.text}`, {
        reply_markup: view.markup,
      });
      return;
    }
    throw error;
  }
}

async function handleMark(ctx: BotContext, dependencies: HandlerDeps, user: User, data: string) {
  if (!data.startsWith("m:") && !data.startsWith("u:")) return false;
  await ctx.answerCallbackQuery({
    text: t(user.locale, data.startsWith("u:") ? "undone" : "marked"),
  });
  const [, habitId, localDate, action] = data.split(":");
  if (!habitId || !localDate) throw new Error("STALE");
  if (data.startsWith("u:")) {
    await dependencies.services.undoEntry({ userId: user.id, habitId, localDate });
  } else {
    const rows = await dependencies.services.listHabitsForToday(user.id, nowFor(dependencies));
    const row = rows.find(
      (candidate) => candidate.habit.id === habitId && candidate.localDate === localDate,
    );
    if (!row || !action) throw new Error("STALE");
    if ((action === "+" || action === "-") && row.habit.type !== "binary") {
      const currentValue = row.entry?.value ?? 0;
      await dependencies.services.setEntryValue({
        userId: user.id,
        habitId,
        localDate,
        value: action === "+" ? currentValue + 1 : Math.max(0, currentValue - 1),
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
  }
  await refreshCallbackMessage(ctx, user, dependencies);
  return true;
}

async function handleSnooze(ctx: BotContext, dependencies: HandlerDeps, user: User, data: string) {
  if (!data.startsWith("s:")) return false;
  await ctx.answerCallbackQuery({ text: t(user.locale, "snoozed") });
  const reminderId = data.slice(2);
  if (!reminderId) throw new Error("STALE");
  await dependencies.services.snoozeReminder(
    reminderId,
    user.id,
    new Date(nowFor(dependencies).valueOf() + 3_600_000),
  );
  await refreshCallbackMessage(
    ctx,
    user,
    dependencies,
    t(user.locale, "snoozedState"),
    backTo(user.locale, "today"),
  );
  return true;
}

async function handleArchive(ctx: BotContext, dependencies: HandlerDeps, user: User, data: string) {
  if (!data.startsWith("a:")) return false;
  await ctx.answerCallbackQuery({ text: t(user.locale, "archived") });
  if (!(await dependencies.services.archiveHabit(data.slice(2), user.id))) throw new Error("STALE");
  await refreshCallbackMessage(
    ctx,
    user,
    dependencies,
    t(user.locale, "archivedState"),
    backTo(user.locale, "habits"),
  );
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
    await ctx.answerCallbackQuery();
    await ctx.reply(t(value, "menuPlaceholder"), replyMenu(value));
  } else if (kind === "z" && value) {
    await dependencies.users.update(user.id, { timezone: value });
    await ctx.answerCallbackQuery();
  } else if (kind === "d" && value) {
    await dependencies.users.update(user.id, { dayStartHour: Number(value) });
    await ctx.answerCallbackQuery();
  } else throw new Error("STALE");
  return true;
}

async function handleWizard(ctx: BotContext, dependencies: HandlerDeps, user: User, data: string) {
  if (data === "new:cancel" || data === "quick:cancel") {
    delete ctx.session.newHabit;
    delete ctx.session.pendingTitle;
    await ctx.answerCallbackQuery();
    await ctx.reply(t(user.locale, "menuPlaceholder"), replyMenu(user.locale));
    return true;
  }
  if (data === "new:interrupt") {
    const target = ctx.session.pendingMenu;
    delete ctx.session.newHabit;
    delete ctx.session.pendingMenu;
    await ctx.answerCallbackQuery();
    if (target) await routeMenu(ctx, dependencies, target);
    return true;
  }
  if (data === "new:continue") {
    delete ctx.session.pendingMenu;
    await ctx.answerCallbackQuery();
    return true;
  }
  if (data === "new:custom") {
    await ctx.answerCallbackQuery();
    await newHabit(ctx, dependencies);
    return true;
  }
  if (data === "tpl:all") {
    await ctx.answerCallbackQuery();
    await ctx.reply(t(user.locale, "templatesTitle"), {
      reply_markup: await templateKeyboard(user.locale, dependencies, true),
    });
    return true;
  }
  if (data.startsWith("tpl:")) {
    const template = (await dependencies.services.listTemplates(user.locale)).find(
      (x) => x.id === data.slice(4),
    );
    if (!template) throw new Error("STALE");
    ctx.session.newHabit = {
      step: "type",
      title: template.title,
      type: template.defaultType,
      schedule: template.defaultSchedule,
    };
    await ctx.answerCallbackQuery();
    await ctx.reply(
      t(user.locale, "newReminder"),
      inline([
        [{ text: t(user.locale, "noReminder"), callback_data: "new:r:no" }],
        [{ text: "09:00", callback_data: "new:r:09:00" }],
      ]),
    );
    return true;
  }
  if (data === "quick:create" && ctx.session.pendingTitle) {
    const title = ctx.session.pendingTitle;
    delete ctx.session.pendingTitle;
    ctx.session.newHabit = { step: "type", title };
    await ctx.answerCallbackQuery();
    await ctx.reply(
      t(user.locale, "newType"),
      inline([
        [
          { text: t(user.locale, "binary"), callback_data: "new:t:binary" },
          { text: t(user.locale, "counter"), callback_data: "new:t:counter" },
          { text: t(user.locale, "duration"), callback_data: "new:t:duration" },
        ],
      ]),
    );
    return true;
  }
  if (data.startsWith("new:t:")) {
    const state = ctx.session.newHabit,
      type = data.slice(6);
    if (!state || !["binary", "counter", "duration"].includes(type)) throw new Error("STALE");
    state.type = type as NonNullable<NewHabitState["type"]>;
    await ctx.answerCallbackQuery();
    if (type === "binary") {
      state.step = "schedule";
      await showSchedulePrompt(ctx);
    } else {
      state.step = "target";
      await showTargetPrompt(ctx);
    }
    return true;
  }
  if (data.startsWith("new:v:")) {
    const state = ctx.session.newHabit,
      [, , raw, unit] = data.split(":");
    if (!state || !raw || !unit) throw new Error("STALE");
    state.targetValue = Number(raw);
    state.unit = unit;
    state.step = "schedule";
    await ctx.answerCallbackQuery();
    await showSchedulePrompt(ctx);
    return true;
  }
  if (data.startsWith("new:s:")) {
    const state = ctx.session.newHabit,
      kind = data.slice(6);
    if (!state) throw new Error("STALE");
    await ctx.answerCallbackQuery();
    if (kind === "daily") state.schedule = { kind: "daily" };
    else if (kind === "days") {
      state.selectedDays = [];
      await ctx.reply(
        t(user.locale, "chooseDays"),
        inline([
          [1, 2, 3, 4, 5, 6, 7].map((day) => ({
            text: String(day),
            callback_data: `new:d:${day}`,
          })),
          [{ text: t(user.locale, "confirm"), callback_data: "new:d:ok" }],
          [{ text: t(user.locale, "cancel"), callback_data: "new:cancel" }],
        ]),
      );
      return true;
    } else if (kind === "week" || kind === "interval") {
      state.scheduleKind = kind === "week" ? "times_per_week" : "interval_days";
      state.step = "schedule_number";
      await showNumberPrompt(ctx);
      return true;
    } else throw new Error("STALE");
    state.step = "reminder";
    await showReminderPrompt(ctx);
    return true;
  }
  if (data.startsWith("new:n:")) {
    const state = ctx.session.newHabit,
      amount = Number(data.slice(6));
    if (!state || !Number.isInteger(amount) || amount <= 0) throw new Error("STALE");
    applyScheduleNumber(state, amount);
    await ctx.answerCallbackQuery();
    await showReminderPrompt(ctx);
    return true;
  }
  if (data.startsWith("new:d:")) {
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
      ? state.selectedDays.filter((x) => x !== day)
      : [...state.selectedDays, day];
    await ctx.answerCallbackQuery({ text: state.selectedDays.join(", ") });
    return true;
  }
  if (data.startsWith("new:r:")) {
    const state = ctx.session.newHabit;
    if (!state?.title || !state.type || !state.schedule) throw new Error("STALE");
    const now = nowFor(dependencies),
      validFrom = await dependencies.services.localDateForUser(user.id, now);
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
    if (time !== "no")
      await dependencies.services.createReminder({
        userId: user.id,
        habitId: habit.id,
        localTime: time,
        daysMask: 127,
        now,
      });
    delete ctx.session.newHabit;
    await ctx.answerCallbackQuery();
    await ctx.reply(
      t(user.locale, "newCreated"),
      inline([
        [
          { text: t(user.locale, "markNow"), callback_data: `m:${habit.id}:${validFrom}:d` },
          { text: t(user.locale, "anotherHabit"), callback_data: "new:custom" },
          { text: t(user.locale, "menuToday"), callback_data: "go:today" },
        ],
      ]),
    );
    return true;
  }
  return false;
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
    if (data.startsWith("stats:")) {
      await ctx.answerCallbackQuery();
      await stats(ctx, dependencies, Number(data.slice(6)));
      return;
    }
    if (data === "go:today") {
      await ctx.answerCallbackQuery();
      await today(ctx, dependencies);
      return;
    }
    if (data === "go:habits") {
      await ctx.answerCallbackQuery();
      await habits(ctx, dependencies);
      return;
    }
    if (data === "go:menu") {
      await ctx.answerCallbackQuery();
      await ctx.reply(t(user.locale, "menuPlaceholder"), replyMenu(user.locale));
      return;
    }
    if (data === "go:help") {
      await ctx.answerCallbackQuery();
      await help(ctx, dependencies);
      return;
    }
    if (await handleWizard(ctx, dependencies, user, data)) return;
    throw new Error("STALE");
  } catch {
    try {
      await ctx.answerCallbackQuery({ text: t(ctx.session.lang, "stale") });
    } catch {}
  }
}
