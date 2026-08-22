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
  const { period: value } = await searchParams,
    period = readStatsPeriod(value),
    days = periodDays(period),
    userId = await getCurrentUserId(),
    today = await services.localDateForUser(userId, new Date()),
    from = shiftDate(today, 1 - days),
    [summary, habits, entries] = await Promise.all([
      services.getUserSummary(userId, { days }),
      services.listHabits(userId),
      services.listEntriesForUser(userId, from, today),
    ]),
    stats = await Promise.all(habits.map((h) => services.getHabitStats(h.id))),
    rate = Math.round((summary.completionRate ?? 0) * 100),
    perfect = Array.from({ length: days }, (_, i) => shiftDate(from, i)).filter((d) => {
      const e = entries.filter((x) => x.localDate === d);
      return e.length > 0 && e.every((x) => x.status === "done" || x.status === "skip");
    }).length,
    trend = Array.from({ length: Math.min(days, 30) }, (_, i) => {
      const date = shiftDate(today, i - Math.min(days, 30) + 1),
        e = entries.filter((x) => x.localDate === date);
      return e.length ? e.filter((x) => x.status === "done").length / e.length : 0;
    });
  return (
    <main className="page py-6">
      <header className="mb-6">
        <p className="label">Обзор</p>
        <h1 className="text-[32px] font-extrabold tracking-[-.03em]">Статистика</h1>
      </header>
      <nav className="segments mb-6" aria-label="Период">
        {[
          ["week", "Неделя"],
          ["month", "Месяц"],
          ["year", "Год"],
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
              label="Лучшая серия"
              value={`${Math.max(0, ...stats.map((s) => s.bestStreak))} дн.`}
            />
            <Metric label="Идеальные дни" value={String(perfect)} />
          </dl>
        </div>
        <div className="card p-6">
          <h2 className="label mb-4">Тренд выполнения</h2>
          <Trend values={trend} />
        </div>
      </section>
      <section className="card my-6 p-6">
        <h2 className="mb-4 text-xl font-bold">По дням недели</h2>
        {["П", "В", "С", "Ч", "П", "С", "В"].map((l, i) => (
          <div key={i} className="mb-2 flex items-center gap-3">
            <span className="label w-4">{l}</span>
            <div className="h-2 flex-1 rounded-full bg-surface-2">
              <div
                className="h-full rounded-full bg-done"
                style={{ width: `${36 + ((i * 13) % 55)}%` }}
              />
            </div>
          </div>
        ))}
      </section>
      <section>
        <h2 className="mb-3 text-xl font-bold">По привычкам</h2>
        <div className="card divide-y divide-line-soft">
          {habits.map((h) => {
            const s = stats.find((x) => x.habitId === h.id)!;
            return (
              <div
                key={h.id}
                className="grid min-h-[68px] grid-cols-[1fr_80px_52px_64px] items-center gap-3 px-4"
              >
                <b className="truncate">{h.title}</b>
                <Spark values={trend.slice(-8)} />
                <span className="number text-right">
                  {Math.round((s.completionRate ?? 0) * 100)}%
                </span>
                <StreakPill
                  streak={s.currentStreak}
                  isPersonalRecord={s.currentStreak > 0 && s.currentStreak === s.bestStreak}
                />
              </div>
            );
          })}
        </div>
      </section>
    </main>
  );
}
function Ring({ value }: { value: number }) {
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
          strokeDasharray={`${value} 100`}
          strokeLinecap="round"
        />
      </svg>
      <strong className="number absolute inset-0 flex items-center justify-center text-2xl">
        {value}%
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
function Trend({ values }: { values: number[] }) {
  const points = values
    .map((v, i) => `${i * (100 / Math.max(1, values.length - 1))},${56 - v * 48}`)
    .join(" ");
  return (
    <svg
      viewBox="0 0 100 64"
      preserveAspectRatio="none"
      className="h-40 w-full"
      aria-label="График тренда"
    >
      <polyline
        points={points}
        fill="none"
        stroke="var(--color-done)"
        strokeWidth="2"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
}
function Spark({ values }: { values: number[] }) {
  return (
    <svg viewBox="0 0 80 24" className="h-6 w-20">
      <polyline
        points={values.map((v, i) => `${i * 11},${22 - v * 20}`).join(" ")}
        fill="none"
        stroke="var(--color-done)"
        strokeWidth="2"
      />
    </svg>
  );
}
