import type { Entry, EntryStatus, LocalDate, ScheduleVersion } from "@ownday/core";

export type TodayHabit = {
  habit: {
    id: string;
    title: string;
    icon: string;
    color: string;
    type: "binary" | "counter" | "duration";
    targetValue: number | null;
    unit: string | null;
    scheduleVersions: ScheduleVersion[];
  };
  localDate: LocalDate;
  entry: (Entry & { value?: number }) | null;
  entries: Entry[];
  startedOn: LocalDate;
  streak: { current: number; best: number; unit: "day" | "week" | "month" };
};

export type Bootstrap = {
  user: { timezone: string; dayStartHour: number; locale: "ru" | "en" };
  today: TodayHabit[];
};

export type MarkInput = {
  habitId: string;
  localDate: LocalDate;
  status: EntryStatus;
  clientId: string;
};
