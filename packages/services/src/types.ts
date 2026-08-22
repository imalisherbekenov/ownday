import type { EntryStatus, LocalDate, ScheduleVersion } from "@ownday/core";

export type Locale = "ru" | "en";
export type HabitType = "binary" | "counter" | "duration";
export type EntrySource = "web" | "tg" | "mobile" | "widget";
export type User = {
  id: string;
  timezone: string;
  dayStartHour: number;
  locale: Locale;
  createdAt: Date;
};
export type Identity = {
  id: string;
  userId: string;
  provider: "telegram" | "email" | "google";
  externalId: string;
};
export type Habit = {
  id: string;
  userId: string;
  title: string;
  icon: string;
  color: string;
  category: string;
  type: HabitType;
  targetValue: number | null;
  unit: string | null;
  sortOrder: number;
  archivedAt: Date | null;
  createdAt: Date;
  scheduleVersions: ScheduleVersion[];
};
export type HabitEntry = {
  id: string;
  habitId: string;
  userId: string;
  localDate: LocalDate;
  value?: number;
  status: EntryStatus;
  source: EntrySource;
  clientId: string;
  createdAt: Date;
  updatedAt: Date;
};
export type HabitStats = {
  habitId: string;
  currentStreak: number;
  bestStreak: number;
  completionRate: number | null;
  computedAt: Date;
  unit: "day" | "week" | "month";
};
export type HabitReminder = {
  id: string;
  userId: string;
  habitId: string | null;
  localTime: string;
  daysMask: number;
  channel: "tg" | "push";
  enabled: boolean;
  nextFireAt: Date;
};

export type CreateHabitInput = Pick<Habit, "userId" | "title" | "type"> & {
  icon?: string | undefined;
  color?: string | undefined;
  category?: string | undefined;
  targetValue?: number | null | undefined;
  unit?: string | null | undefined;
  sortOrder?: number | undefined;
  schedule: ScheduleVersion["schedule"];
  validFrom: LocalDate;
};
export type UpdateHabitInput = Partial<
  Pick<Habit, "title" | "icon" | "color" | "category" | "targetValue" | "unit" | "sortOrder">
> & { schedule?: ScheduleVersion["schedule"]; validFrom?: LocalDate };
