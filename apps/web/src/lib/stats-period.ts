export type StatsPeriod = "week" | "month" | "year";
export function readStatsPeriod(value: string | undefined): StatsPeriod {
  return value === "week" || value === "year" ? value : "month";
}
export const periodDays = (p: StatsPeriod) => (p === "week" ? 7 : p === "year" ? 365 : 30);
