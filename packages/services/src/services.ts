import {
  completionRate,
  computeStreak,
  isDue,
  localDateFor,
  nextFireAt,
  scheduleAt,
  type LocalDate,
} from "@habits/core";
import type {
  EntryRepository,
  HabitRepository,
  ReminderRepository,
  UserRepository,
} from "./repositories.js";
import type { CreateHabitInput, EntrySource, UpdateHabitInput } from "./types.js";

export type ServiceDependencies = {
  habits: HabitRepository;
  entries: EntryRepository;
  users: UserRepository;
  reminders: ReminderRepository;
  clock?: () => Date;
};

const shiftDays = (date: LocalDate, days: number): LocalDate =>
  new Date(Date.parse(`${date}T00:00:00Z`) + days * 86_400_000).toISOString().slice(0, 10);

export function createServices(dependencies: ServiceDependencies) {
  const clock = dependencies.clock ?? (() => new Date());

  async function requireUser(userId: string) {
    const user = await dependencies.users.findById(userId);
    if (!user) throw new Error("USER_NOT_FOUND");
    return user;
  }

  async function requireOwnedHabit(habitId: string, userId: string) {
    const habit = await dependencies.habits.findById(habitId);
    if (!habit || habit.userId !== userId) throw new Error("HABIT_NOT_FOUND");
    return habit;
  }

  return {
    createHabit: (input: CreateHabitInput) => dependencies.habits.create(input),
    updateHabit: (id: string, userId: string, input: UpdateHabitInput) =>
      dependencies.habits.update(id, userId, input),
    archiveHabit: (id: string, userId: string) => dependencies.habits.archive(id, userId, clock()),
    reorderHabits: (userId: string, ids: string[]) => dependencies.habits.reorder(userId, ids),
    listHabits: (userId: string, includeArchived = false) =>
      dependencies.habits.listByUser(userId, includeArchived),

    async localDateForUser(userId: string, now: Date) {
      const user = await requireUser(userId);
      return localDateFor(now, user.timezone, user.dayStartHour);
    },

    async listHabitsForToday(userId: string, now: Date) {
      const user = await requireUser(userId);
      const localDate = localDateFor(now, user.timezone, user.dayStartHour);
      const habits = await dependencies.habits.listByUser(userId);
      const result = [];

      for (const habit of habits) {
        if (!isDue(scheduleAt(habit.scheduleVersions, localDate), localDate)) continue;
        const entries = await dependencies.entries.listForHabit(habit.id, localDate);
        const entry = entries.find((candidate) => candidate.localDate === localDate) ?? null;
        const streak = computeStreak({
          versions: habit.scheduleVersions,
          entries,
          today: localDate,
          startedOn: habit.createdAt.toISOString().slice(0, 10),
        });
        result.push({ habit, localDate, entry, streak });
      }
      return result;
    },

    async markEntry(input: Parameters<EntryRepository["upsert"]>[0]) {
      const existing = await dependencies.entries.findByClientId(input.clientId);
      if (existing) return existing;
      await requireOwnedHabit(input.habitId, input.userId);
      return dependencies.entries.upsert(input);
    },

    async setEntryValue(input: {
      userId: string;
      habitId: string;
      localDate: LocalDate;
      value: number;
      source: EntrySource;
    }) {
      const habit = await requireOwnedHabit(input.habitId, input.userId);
      if (habit.type === "binary") throw new Error("HABIT_NOT_NUMERIC");
      const value = Math.max(0, input.value);
      const status = habit.targetValue !== null && value >= habit.targetValue ? "done" : "miss";
      return dependencies.entries.setValue({ ...input, value, status });
    },

    undoEntry: (input: { userId: string; habitId: string; localDate: LocalDate }) =>
      dependencies.entries.delete(input.habitId, input.localDate, input.userId),

    async getHabitStats(habitId: string, now = clock()) {
      const habit = await dependencies.habits.findById(habitId);
      if (!habit) throw new Error("HABIT_NOT_FOUND");
      const user = await requireUser(habit.userId);
      const today = localDateFor(now, user.timezone, user.dayStartHour);
      const entries = await dependencies.entries.listForHabit(habitId, today);
      const startedOn = habit.createdAt.toISOString().slice(0, 10);
      const streak = computeStreak({ versions: habit.scheduleVersions, entries, today, startedOn });
      const rate = completionRate({ versions: habit.scheduleVersions, entries, today, startedOn });
      const stats = {
        habitId,
        currentStreak: streak.current,
        bestStreak: streak.best,
        completionRate: rate,
        computedAt: now,
        unit: streak.unit,
      };
      await dependencies.habits.writeStats(stats);
      return stats;
    },

    async getUserSummary(userId: string, period: { days: number; now?: Date }) {
      const user = await requireUser(userId);
      const through = localDateFor(period.now ?? clock(), user.timezone, user.dayStartHour);
      const from = shiftDays(through, -(period.days - 1));
      const habits = await dependencies.habits.listByUser(userId, true);
      const entries = await dependencies.entries.listForUser(userId, from, through);
      let done = 0;
      let due = 0;

      for (const habit of habits) {
        for (let date = from; date <= through; date = shiftDays(date, 1)) {
          if (!isDue(scheduleAt(habit.scheduleVersions, date), date)) continue;
          const status = entries.find(
            (entry) => entry.habitId === habit.id && entry.localDate === date,
          )?.status;
          if (status === "skip") continue;
          due += 1;
          if (status === "done") done += 1;
        }
      }
      return { from, through, done, due, completionRate: due ? done / due : null };
    },

    async ensureUserFromTelegram(
      telegramId: string,
      input: { timezone: string; dayStartHour?: number; locale?: "ru" | "en" },
    ) {
      const found = await dependencies.users.findIdentity("telegram", telegramId);
      return (
        found?.user ??
        dependencies.users.createWithIdentity({
          provider: "telegram",
          externalId: telegramId,
          timezone: input.timezone,
          dayStartHour: input.dayStartHour ?? 4,
          locale: input.locale ?? "ru",
        })
      );
    },

    dueReminders: (now: Date, limit = 100) => dependencies.reminders.due(now, limit),
    listReminders: (userId: string) => dependencies.reminders.listByUser(userId),

    async createReminder(input: {
      userId: string;
      habitId: string;
      localTime: string;
      daysMask: number;
      now: Date;
    }) {
      const user = await requireUser(input.userId);
      await requireOwnedHabit(input.habitId, input.userId);
      return dependencies.reminders.create({
        userId: input.userId,
        habitId: input.habitId,
        localTime: input.localTime,
        daysMask: input.daysMask,
        channel: "tg",
        enabled: true,
        nextFireAt: nextFireAt(
          { localTime: input.localTime, daysMask: input.daysMask },
          user.timezone,
          input.now,
        ),
      });
    },

    async snoozeReminder(reminderId: string, userId: string, until: Date) {
      const reminder = await dependencies.reminders.findById(reminderId);
      if (!reminder || reminder.userId !== userId) throw new Error("REMINDER_NOT_FOUND");
      return dependencies.reminders.updateNextFireAt(reminderId, until);
    },

    async advanceReminder(reminderId: string, now: Date) {
      const reminder = await dependencies.reminders.findById(reminderId);
      if (!reminder) throw new Error("REMINDER_NOT_FOUND");
      const user = await requireUser(reminder.userId);
      return dependencies.reminders.updateNextFireAt(
        reminderId,
        nextFireAt(
          { localTime: reminder.localTime, daysMask: reminder.daysMask },
          user.timezone,
          now,
        ),
      );
    },
  };
}

export type Services = ReturnType<typeof createServices>;
