export type Lang = "ru" | "en";
export type Variant = "a" | "b" | "c";
export type Scenario = "daily" | "new" | "complete" | "offline" | "error";
export type Localized = Record<Lang, string>;
export type Habit = {
  id: string;
  title: Localized;
  icon: string;
  type: "binary" | "counter" | "duration";
  target: number;
  unit: Localized;
  time: "morning" | "afternoon" | "evening";
  schedule: "daily" | "weekdays" | "weekly";
  weeklyTarget: number;
  startedOn: string;
};
export type Entry = { value: number; status: "done" | "partial" | "skip" };
export type DemoData = { habits: Habit[]; entries: Record<string, Entry> };
export const TODAY = "2026-09-13";
export const STORAGE_KEY = "ownday.design-lab.v1";
export const shiftDate = (date: string, days: number) =>
  new Date(Date.parse(`${date}T12:00:00Z`) + days * 86400000).toISOString().slice(0, 10);
export const weekday = (date: string) => new Date(`${date}T12:00:00Z`).getUTCDay();
export const monday = (date: string) => shiftDate(date, -((weekday(date) + 6) % 7));
export const dates = (end: string, count: number) =>
  Array.from({ length: count }, (_, i) => shiftDate(end, i - count + 1));
export const keyFor = (id: string, date: string) => `${id}:${date}`;
export const entryFor = (data: DemoData, habit: Habit, date: string) =>
  data.entries[keyFor(habit.id, date)];
export const isDue = (habit: Habit, date: string) =>
  date >= habit.startedOn &&
  (habit.schedule !== "weekdays" || (weekday(date) > 0 && weekday(date) < 6));
export const titleFor = (habit: Habit, lang: Lang) => habit.title[lang];

const seedHabits: Habit[] = [
  {
    id: "water",
    title: { ru: "Пить достаточно воды", en: "Stay hydrated" },
    icon: "water",
    type: "counter",
    target: 8,
    unit: { ru: "стак.", en: "glasses" },
    time: "morning",
    schedule: "daily",
    weeklyTarget: 3,
    startedOn: shiftDate(TODAY, -41),
  },
  {
    id: "read",
    title: { ru: "Читать 20 страниц", en: "Read 20 pages" },
    icon: "book",
    type: "counter",
    target: 20,
    unit: { ru: "стр.", en: "pages" },
    time: "afternoon",
    schedule: "daily",
    weeklyTarget: 3,
    startedOn: shiftDate(TODAY, -41),
  },
  {
    id: "move",
    title: { ru: "Выйти на прогулку", en: "Take a little walk" },
    icon: "walk",
    type: "duration",
    target: 30,
    unit: { ru: "мин", en: "min" },
    time: "afternoon",
    schedule: "daily",
    weeklyTarget: 3,
    startedOn: shiftDate(TODAY, -41),
  },
  {
    id: "breathe",
    title: { ru: "Побыть в тишине", en: "Find a quiet moment" },
    icon: "sun",
    type: "duration",
    target: 5,
    unit: { ru: "мин", en: "min" },
    time: "morning",
    schedule: "daily",
    weeklyTarget: 3,
    startedOn: shiftDate(TODAY, -41),
  },
  {
    id: "journal",
    title: { ru: "Записать хорошее за день", en: "Write down the good" },
    icon: "pen",
    type: "binary",
    target: 1,
    unit: { ru: "раз", en: "time" },
    time: "evening",
    schedule: "daily",
    weeklyTarget: 3,
    startedOn: shiftDate(TODAY, -41),
  },
];

export function seedData(scenario: Scenario = "daily"): DemoData {
  if (scenario === "new") return { habits: [], entries: {} };
  const habits = structuredClone(seedHabits);
  const entries: Record<string, Entry> = {};
  habits.forEach((habit, hi) => {
    dates(shiftDate(TODAY, -1), 41).forEach((date, di) => {
      if ((di * (hi + 2) + hi) % (7 + hi) > hi % 3) {
        entries[keyFor(habit.id, date)] = { status: "done", value: habit.target };
      } else if (di % 9 === 0) entries[keyFor(habit.id, date)] = { status: "skip", value: 0 };
    });
  });
  entries[keyFor("water", TODAY)] = { status: "partial", value: 4 };
  entries[keyFor("read", TODAY)] = { status: "partial", value: 12 };
  entries[keyFor("breathe", TODAY)] = { status: "done", value: 5 };
  entries[keyFor("journal", TODAY)] = { status: "done", value: 1 };
  if (scenario === "complete")
    habits.forEach((habit) => {
      entries[keyFor(habit.id, TODAY)] = { status: "done", value: habit.target };
    });
  return { habits, entries };
}

export function changeEntry(
  data: DemoData,
  habit: Habit,
  date: string,
  action: "toggle" | "skip" | "undo" | number,
): DemoData {
  if (date > TODAY || !isDue(habit, date)) return data;
  const key = keyFor(habit.id, date);
  const entries = { ...data.entries };
  const previous = entries[key];
  if (action === "undo" || (action === "toggle" && previous?.status === "done"))
    delete entries[key];
  else if (action === "skip" && previous?.status === "skip") {
    if (previous.value > 0)
      entries[key] = {
        status: previous.value >= habit.target ? "done" : "partial",
        value: previous.value,
      };
    else delete entries[key];
  } else if (action === "skip") entries[key] = { status: "skip", value: previous?.value ?? 0 };
  else if (action === "toggle") entries[key] = { status: "done", value: habit.target };
  else if (typeof action === "number") {
    const value = Math.max(0, Math.min(100000, (previous?.value ?? 0) + action));
    if (value === 0) delete entries[key];
    else entries[key] = { status: value >= habit.target ? "done" : "partial", value };
  }
  return { ...data, entries };
}

export function dayStats(data: DemoData, date: string) {
  const habits = data.habits.filter((habit) => isDue(habit, date));
  const skipped = habits.filter((habit) => entryFor(data, habit, date)?.status === "skip").length;
  const done = habits.filter((habit) => entryFor(data, habit, date)?.status === "done").length;
  const due = habits.length - skipped;
  return { done, due, skipped, percent: due ? Math.round((done / due) * 100) : 0 };
}

export function habitRate(data: DemoData, habit: Habit, end: string, count: number) {
  const range = dates(end, count).filter((date) => date <= TODAY && isDue(habit, date));
  if (habit.schedule === "weekly") {
    const weeks = new Map<string, { done: number; available: number }>();
    for (const date of range) {
      const entry = entryFor(data, habit, date);
      const bucket = weeks.get(monday(date)) ?? { done: 0, available: 0 };
      if (entry?.status !== "skip") bucket.available++;
      if (entry?.status === "done") bucket.done++;
      weeks.set(monday(date), bucket);
    }
    let done = 0,
      due = 0;
    weeks.forEach((bucket) => {
      const target = Math.min(habit.weeklyTarget, bucket.available);
      done += Math.min(target, bucket.done);
      due += target;
    });
    return { done, due, percent: due ? Math.round((done / due) * 100) : 0 };
  }
  const due = range.filter((date) => entryFor(data, habit, date)?.status !== "skip").length;
  const done = range.filter((date) => entryFor(data, habit, date)?.status === "done").length;
  return { done, due, percent: due ? Math.round((done / due) * 100) : 0 };
}

export function streak(data: DemoData, habit: Habit, end: string): number {
  if (habit.schedule === "weekly") {
    let result = 0;
    for (let w = 0; w < 8; w++) {
      const weekEnd = shiftDate(monday(end), 6 - w * 7);
      const completed = dates(weekEnd, 7).filter(
        (date) => date <= end && entryFor(data, habit, date)?.status === "done",
      ).length;
      if (completed >= habit.weeklyTarget) result++;
      else if (w > 0) break;
    }
    return result;
  }
  let result = 0;
  for (let date = end; date >= habit.startedOn; date = shiftDate(date, -1)) {
    if (!isDue(habit, date)) continue;
    const entry = entryFor(data, habit, date);
    if (entry?.status === "skip") continue;
    if (entry?.status === "done") result++;
    else if (date !== TODAY) break;
  }
  return result;
}

export function summary(data: DemoData, end: string, count: number) {
  const rates = data.habits.map((habit) => habitRate(data, habit, end, count));
  const done = rates.reduce((sum, item) => sum + item.done, 0);
  const due = rates.reduce((sum, item) => sum + item.due, 0);
  const perfect = dates(end, count).filter((date) => {
    const stat = dayStats(data, date);
    return date <= TODAY && stat.due > 0 && stat.done === stat.due;
  }).length;
  return { done, due, perfect, percent: due ? Math.round((done / due) * 100) : 0 };
}

export function isDemoData(value: unknown): value is DemoData {
  if (!value || typeof value !== "object") return false;
  const data = value as DemoData;
  return (
    Array.isArray(data.habits) &&
    data.habits.length <= 100 &&
    data.habits.every(
      (h) =>
        typeof h.id === "string" &&
        typeof h.title?.ru === "string" &&
        typeof h.title?.en === "string" &&
        typeof h.icon === "string" &&
        ["binary", "counter", "duration"].includes(h.type) &&
        Number.isFinite(h.target) &&
        h.target > 0 &&
        typeof h.unit?.ru === "string" &&
        typeof h.unit?.en === "string" &&
        ["morning", "afternoon", "evening"].includes(h.time) &&
        ["daily", "weekdays", "weekly"].includes(h.schedule) &&
        Number.isInteger(h.weeklyTarget) &&
        h.weeklyTarget >= 1 &&
        h.weeklyTarget <= 7 &&
        /^\d{4}-\d{2}-\d{2}$/.test(h.startedOn) &&
        !Number.isNaN(Date.parse(h.startedOn)),
    ) &&
    Boolean(data.entries) &&
    typeof data.entries === "object" &&
    Object.values(data.entries).every(
      (e) =>
        Boolean(e) &&
        ["done", "partial", "skip"].includes(e.status) &&
        Number.isFinite(e.value) &&
        e.value >= 0,
    )
  );
}
