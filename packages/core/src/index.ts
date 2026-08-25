export type LocalDate = string;
export type EntryStatus = "done" | "skip" | "miss";
export type Schedule =
  | { kind: "daily" }
  | { kind: "days_of_week"; days: number[] }
  | { kind: "times_per_week"; target: number }
  | { kind: "times_per_month"; target: number }
  | { kind: "interval_days"; every: number; anchor: LocalDate };
export type ScheduleVersion = { schedule: Schedule; validFrom: LocalDate };
export type Entry = { localDate: LocalDate; status: EntryStatus; value?: number };
export type Reminder = { localTime: string; daysMask: number[] | number };

const DAY = 86_400_000;
const parseDate = (date: LocalDate): Date => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new RangeError(`Invalid LocalDate: ${date}`);
  const parsed = new Date(`${date}T00:00:00Z`);
  if (Number.isNaN(parsed.valueOf()) || parsed.toISOString().slice(0, 10) !== date)
    throw new RangeError(`Invalid LocalDate: ${date}`);
  return parsed;
};
const addDays = (date: LocalDate, count: number): LocalDate =>
  new Date(parseDate(date).valueOf() + count * DAY).toISOString().slice(0, 10);
const diffDays = (left: LocalDate, right: LocalDate): number =>
  Math.round((parseDate(left).valueOf() - parseDate(right).valueOf()) / DAY);
export const isoWeekday = (date: LocalDate): number => parseDate(date).getUTCDay() || 7;

function zonedParts(date: Date, timeZone: string): Record<string, number> {
  const result: Record<string, number> = {};
  for (const part of new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date))
    if (part.type !== "literal") result[part.type] = Number(part.value);
  return result;
}

export function localDateFor(instant: Date, tz: string, dayStartHour: number): LocalDate {
  if (!Number.isInteger(dayStartHour) || dayStartHour < 0 || dayStartHour > 23)
    throw new RangeError("dayStartHour must be 0..23");
  const shifted = new Date(instant.valueOf() - dayStartHour * 3_600_000);
  const p = zonedParts(shifted, tz);
  return `${p.year}-${String(p.month).padStart(2, "0")}-${String(p.day).padStart(2, "0")}`;
}

export function scheduleAt(versions: ScheduleVersion[], date: LocalDate): Schedule {
  parseDate(date);
  const active = versions
    .filter((v) => v.validFrom <= date)
    .sort((a, b) => b.validFrom.localeCompare(a.validFrom))[0];
  if (!active) throw new RangeError(`No schedule active on ${date}`);
  return active.schedule;
}

export function isDue(schedule: Schedule, date: LocalDate): boolean {
  parseDate(date);
  if (
    schedule.kind === "daily" ||
    schedule.kind === "times_per_week" ||
    schedule.kind === "times_per_month"
  )
    return true;
  if (schedule.kind === "days_of_week") return schedule.days.includes(isoWeekday(date));
  if (!Number.isInteger(schedule.every) || schedule.every <= 0)
    throw new RangeError("Interval must be positive");
  return (
    ((diffDays(date, schedule.anchor) % schedule.every) + schedule.every) % schedule.every === 0
  );
}

type StreakParams = {
  versions: ScheduleVersion[];
  entries: Entry[];
  today: LocalDate;
  startedOn: LocalDate;
};
type Streak = { current: number; best: number; unit: "day" | "week" | "month" };
const entryMap = (entries: Entry[]) => new Map(entries.map((entry) => [entry.localDate, entry]));

function fixedStreak(params: StreakParams): Streak {
  const byDate = entryMap(params.entries);
  const outcomes: Array<"done" | "skip" | "break"> = [];
  for (let date = params.startedOn; date <= params.today; date = addDays(date, 1)) {
    if (!isDue(scheduleAt(params.versions, date), date)) continue;
    const status = byDate.get(date)?.status;
    if (date === params.today && status === undefined) continue;
    outcomes.push(status === "done" ? "done" : status === "skip" ? "skip" : "break");
  }
  let run = 0,
    best = 0;
  for (const outcome of outcomes) {
    if (outcome === "done") {
      run++;
      best = Math.max(best, run);
    } else if (outcome === "break") run = 0;
  }
  let current = 0;
  for (let i = outcomes.length - 1; i >= 0; i--) {
    const outcome = outcomes[i];
    if (outcome === "break") break;
    if (outcome === "done") current++;
  }
  return { current, best, unit: "day" };
}

const weekKey = (date: LocalDate): string => {
  const d = parseDate(date);
  d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));
  const year = d.getUTCFullYear();
  const first = new Date(Date.UTC(year, 0, 1));
  return `${year}-W${String(Math.ceil(((d.valueOf() - first.valueOf()) / DAY + 1) / 7)).padStart(2, "0")}`;
};
const monthKey = (date: LocalDate): string => date.slice(0, 7);

function periodStreak(params: StreakParams, unit: "week" | "month"): Streak {
  const keyFor = unit === "week" ? weekKey : monthKey;
  const periods: string[] = [];
  for (let date = params.startedOn; date <= params.today; date = addDays(date, 1)) {
    const key = keyFor(date);
    if (!periods.includes(key)) periods.push(key);
  }
  const todayKey = keyFor(params.today);
  const outcomes = periods
    .filter((key) => key !== todayKey)
    .map((key) => {
      const dates = params.entries.filter(
        (e) => keyFor(e.localDate) === key && e.status === "done",
      );
      const representative =
        unit === "week"
          ? params.entries.find((e) => keyFor(e.localDate) === key)?.localDate
          : `${key}-01`;
      const date = representative ?? params.startedOn;
      const schedule = scheduleAt(params.versions, date);
      const target =
        schedule.kind === "times_per_week" || schedule.kind === "times_per_month"
          ? schedule.target
          : 1;
      return dates.length >= target;
    });
  let run = 0,
    best = 0;
  for (const complete of outcomes) {
    run = complete ? run + 1 : 0;
    best = Math.max(best, run);
  }
  return { current: run, best, unit };
}

export function computeStreak(params: StreakParams): Streak {
  if (params.startedOn > params.today) return { current: 0, best: 0, unit: "day" };
  const currentSchedule = scheduleAt(params.versions, params.today);
  if (currentSchedule.kind === "times_per_week") return periodStreak(params, "week");
  if (currentSchedule.kind === "times_per_month") return periodStreak(params, "month");
  return fixedStreak(params);
}

export function completionRate(params: StreakParams): number | null {
  const byDate = entryMap(params.entries);
  let due = 0,
    done = 0;
  for (let date = params.startedOn; date <= params.today; date = addDays(date, 1)) {
    if (!isDue(scheduleAt(params.versions, date), date)) continue;
    const status = byDate.get(date)?.status;
    if (status === "skip") continue;
    due++;
    if (status === "done") done++;
  }
  return due === 0 ? null : done / due;
}

export function completionByWeekday(params: StreakParams): Array<number | null> {
  const byDate = entryMap(params.entries);
  const buckets = Array.from({ length: 7 }, () => ({ done: 0, due: 0 }));
  for (let date = params.startedOn; date <= params.today; date = addDays(date, 1)) {
    if (!isDue(scheduleAt(params.versions, date), date)) continue;
    const status = byDate.get(date)?.status;
    if (status === "skip") continue;
    const bucket = buckets[isoWeekday(date) - 1]!;
    bucket.due++;
    if (status === "done") bucket.done++;
  }
  return buckets.map(({ done, due }) => (due === 0 ? null : done / due));
}

const maskIncludes = (mask: number[] | number, day: number): boolean =>
  Array.isArray(mask) ? mask.includes(day) : (mask & (1 << (day - 1))) !== 0;

export function nextFireAt(reminder: Reminder, tz: string, now: Date): Date {
  const time = /^(\d{2}):(\d{2})(?::(\d{2}))?$/.exec(reminder.localTime);
  if (!time) throw new RangeError("localTime must be HH:mm or HH:mm:ss");
  const hour = Number(time[1]),
    minute = Number(time[2]),
    second = Number(time[3] ?? 0);
  if (hour > 23 || minute > 59 || second > 59) throw new RangeError("Invalid localTime");
  const localNow = zonedParts(now, tz);
  const base = `${localNow.year}-${String(localNow.month).padStart(2, "0")}-${String(localNow.day).padStart(2, "0")}`;
  for (let offset = 0; offset < 8; offset++) {
    const localDate = addDays(base, offset);
    if (!maskIncludes(reminder.daysMask, isoWeekday(localDate))) continue;
    const [y, m, d] = localDate.split("-").map(Number) as [number, number, number];
    const estimate = Date.UTC(y, m - 1, d, hour, minute, second);
    let firstAfterGap: Date | undefined;
    for (
      let stamp = estimate - 15 * 3_600_000;
      stamp <= estimate + 15 * 3_600_000;
      stamp += 60_000
    ) {
      const candidate = new Date(stamp);
      const p = zonedParts(candidate, tz);
      if (p.year !== y || p.month !== m || p.day !== d) continue;
      if (p.hour === hour && p.minute === minute && p.second === second && candidate > now)
        return candidate;
      const localMinutes = (p.hour ?? 0) * 60 + (p.minute ?? 0);
      if (!firstAfterGap && localMinutes > hour * 60 + minute && candidate > now)
        firstAfterGap = candidate;
    }
    if (firstAfterGap) return firstAfterGap;
  }
  throw new RangeError("No firing day in the next week");
}
