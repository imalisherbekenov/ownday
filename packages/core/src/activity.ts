import type { Entry } from "./index.js";
export type InactiveRange = { from: string; through: string | null };
export const isInactiveOn = (ranges: InactiveRange[], date: string) =>
  ranges.some((range) => date >= range.from && (range.through === null || date < range.through));
const shift = (date: string, days: number) =>
  new Date(Date.parse(`${date}T00:00:00Z`) + days * 86400000).toISOString().slice(0, 10);
/** Archive periods are pauses in statistics; original history remains untouched. */
export function withInactiveDays(
  entries: Entry[],
  ranges: InactiveRange[],
  from: string,
  through: string,
): Entry[] {
  const history = new Map(entries.map((entry) => [entry.localDate, entry]));
  for (const range of ranges) {
    const start = range.from > from ? range.from : from,
      last = range.through === null ? through : shift(range.through, -1),
      end = last < through ? last : through;
    for (let date = start; date <= end; date = shift(date, 1))
      history.set(date, { ...history.get(date), localDate: date, status: "skip" });
  }
  return [...history.values()];
}
