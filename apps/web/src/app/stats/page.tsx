import { interfaceLocale } from "@/lib/interface-locale";
import Link from "next/link";
import { getCurrentUserId, services } from "@/lib/services";
import { periodDays, readStatsPeriod } from "@/lib/stats-period";
import { shiftDate } from "@/lib/view-data";
import { StreakPill } from "@ownday/ui";
export const dynamic = "force-dynamic";
export default async function StatsPage({
  searchParams,
}: {
  searchParams: Promise<{ period?: string }>;
}) {
  const locale = await interfaceLocale(),
    t = (ru: string, en: string) => (locale === "ru" ? ru : en);
  const { period: value } = await searchParams,
    period = readStatsPeriod(value),
    days = periodDays(period),
    userId = await getCurrentUserId(),
    today = await services.localDateForUser(userId, new Date()),
    from = shiftDate(today, 1 - days),
    [summary, habits] = await Promise.all([
      services.getUserSummary(userId, { days }),
      services.listHabits(userId, true),
    ]),
    stats = await Promise.all(habits.map((h) => services.getHabitStats(h.id, userId))),
    rate = summary.completionRate === null ? null : Math.round(summary.completionRate * 100),
    perfect = summary.perfectDays,
    trend = summary.trend.map((point) => point.rate);
  return (
    <main className="page py-6">
      <header className="app-header journal-heading">
        <p className="label">{t("Обзор", "Your rhythm")}</p>
        <h1 className="text-[32px] font-extrabold tracking-[-.03em]">
          {t("Статистика", "Progress, not perfection.")}
        </h1>
      </header>
      <nav className="segments mb-6" aria-label={t("Период", "Period")}>
        {[
          ["week", t("Неделя", "Week")],
          ["month", t("Месяц", "Month")],
          ["year", t("Год", "Year")],
        ].map(([v, l]) => (
          <Link
            key={v}
            href={`/stats?period=${v}`}
            aria-current={period === v ? "page" : undefined}
            className="segment flex items-center justify-center aria-[current=page]:bg-surface aria-[current=page]:text-ink"
          >
            {l}
          </Link>
        ))}
      </nav>
      <section className="grid gap-6 lg:grid-cols-[1fr_2fr]">
        <div className="card flex items-center gap-6 p-6">
          <Ring value={rate} />
          <dl className="space-y-3">
            <Metric
              label={t("Лучшая дневная серия", "Best daily streak")}
              value={`${Math.max(0, ...stats.filter((s) => s.unit === "day").map((s) => s.bestStreak))} ${t("дн.", "days")}`}
            />
            <Metric label={t("Идеальные дни", "Complete days")} value={String(perfect)} />
          </dl>
        </div>
        <div className="card p-6">
          <h2 className="label mb-4">{t("Тренд выполнения", "Your recent rhythm")}</h2>
          <Trend values={trend} label={t("Доля выполнения по дням", "Daily completion rate")} />
          <details className="mt-4">
            <summary className="cursor-pointer text-sm text-ink-3">
              {t("Числа по дням", "Daily values")}
            </summary>
            <ul className="mt-3 max-h-48 overflow-auto text-sm">
              {summary.trend.map((point) => (
                <li key={point.localDate}>
                  {point.localDate}:{" "}
                  {point.rate === null ? "—" : `${Math.round(point.rate * 100)}%`}
                </li>
              ))}
            </ul>
          </details>
        </div>
      </section>
      <section className="card my-6 p-6">
        <h2 className="mb-4 text-xl font-bold">{t("По дням недели", "By weekday")}</h2>
        {(locale === "ru"
          ? ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"]
          : ["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"]
        ).map((l, i) => (
          <div key={i} className="mb-2 flex items-center gap-3">
            <span className="label w-4">{l}</span>
            <div className="h-2 flex-1 rounded-full bg-surface-2">
              <div
                className="h-full rounded-full bg-done"
                style={{ width: `${(summary.byWeekday[i] ?? 0) * 100}%` }}
              />
            </div>
            <span className="number w-12 text-right text-sm text-ink-3">
              {summary.byWeekday[i] === null || summary.byWeekday[i] === undefined
                ? "—"
                : `${Math.round(summary.byWeekday[i]! * 100)}%`}
            </span>
          </div>
        ))}
      </section>
      <section>
        <h2 className="mb-3 text-xl font-bold">{t("По привычкам", "Each little habit")}</h2>
        <div className="card divide-y divide-line-soft">
          {habits.map((h) => {
            const s = stats.find((x) => x.habitId === h.id)!;
            const periodStats = summary.habitSummaries.find((x) => x.habitId === h.id)!;
            return (
              <div
                key={h.id}
                className="grid min-h-[88px] grid-cols-[minmax(0,1fr)_52px] items-center gap-3 px-4 py-4 sm:grid-cols-[minmax(0,1fr)_80px_52px_64px]"
              >
                <Link href={`/habit/${h.id}`} className="min-w-0 break-words font-bold">
                  {h.title}
                </Link>
                <Spark values={periodStats.trend.slice(-8)} />
                <span className="number text-right">
                  {periodStats.completionRate === null
                    ? "—"
                    : `${Math.round(periodStats.completionRate * 100)}%`}
                </span>
                <span className="hidden sm:block">
                  <StreakPill
                    streak={s.currentStreak}
                    isPersonalRecord={s.currentStreak > 0 && s.currentStreak === s.bestStreak}
                  />
                </span>
              </div>
            );
          })}
        </div>
      </section>
    </main>
  );
}
function Ring({ value }: { value: number | null }) {
  return (
    <div className="relative h-28 w-28 shrink-0">
      <svg viewBox="0 0 120 120" className="-rotate-90">
        <circle
          cx="60"
          cy="60"
          r="48"
          fill="none"
          stroke="var(--color-surface-2)"
          strokeWidth="12"
        />
        <circle
          cx="60"
          cy="60"
          r="48"
          fill="none"
          stroke="var(--color-done)"
          strokeWidth="12"
          pathLength="100"
          strokeDasharray={`${value ?? 0} 100`}
          strokeLinecap="round"
        />
      </svg>
      <strong className="number absolute inset-0 flex items-center justify-center text-2xl">
        {value === null ? "—" : `${value}%`}
      </strong>
    </div>
  );
}
function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="label">{label}</dt>
      <dd className="number text-xl font-bold">{value}</dd>
    </div>
  );
}
function plotPath(values: Array<number | null>, width: number, height: number) {
  return values
    .map((v, i) =>
      v === null
        ? ""
        : `${i === 0 || values[i - 1] === null ? "M" : "L"}${i * (width / Math.max(1, values.length - 1))},${height - v * height}`,
    )
    .join(" ");
}
function Trend({ values, label }: { values: Array<number | null>; label: string }) {
  return (
    <svg
      viewBox="0 0 100 64"
      preserveAspectRatio="none"
      className="h-40 w-full"
      aria-label={label}
      role="img"
    >
      <path
        d={plotPath(values, 100, 56)}
        fill="none"
        stroke="var(--color-done)"
        strokeWidth="2"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
}
function Spark({ values }: { values: Array<number | null> }) {
  return (
    <svg viewBox="0 0 80 24" className="hidden h-6 w-20 sm:block" aria-hidden="true">
      <path d={plotPath(values, 78, 22)} fill="none" stroke="var(--color-done)" strokeWidth="2" />
    </svg>
  );
}
