import Link from "next/link";
import { notFound } from "next/navigation";
import { getCurrentUserId, repositories, services } from "@/lib/services";
import { Heatmap, WeekStrip } from "@ownday/ui";
import { PrimaryActionAdapter } from "@/components/primary-action-adapter";
import { markHabitAction } from "@/app/actions";
import { heatPoints, weekDays } from "@/lib/view-data";
export const dynamic = "force-dynamic";
export default async function HabitDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params,
    userId = await getCurrentUserId();
  const habit = (await services.listHabits(userId, true)).find((h) => h.id === id);
  if (!habit) notFound();
  const now = new Date(),
    today = await services.localDateForUser(userId, now);
  const [stats, entries] = await Promise.all([
      services.getHabitStats(id, now),
      repositories.entries.listForHabit(id, today),
    ]),
    month = entries.filter((e) => e.localDate.slice(0, 7) === today.slice(0, 7)),
    done = month.filter((e) => e.status === "done").length,
    skipped = month.filter((e) => e.status === "skip").length,
    missed = month.filter((e) => e.status === "miss").length;
  return (
    <main className="page">
      <header className="app-header flex items-center justify-between py-5">
        <Link
          href="/"
          className="flex h-11 w-11 items-center justify-center rounded-full bg-surface"
          aria-label="Back"
        >
          ←
        </Link>
        <b>Habit detail</b>
        <span className="h-11 w-11" />
      </header>
      <section className="flex items-center gap-3">
        <div
          className="flex h-12 w-12 items-center justify-center rounded-full bg-surface-2 text-xl"
          style={{ color: `var(--color-hue-${habit.color})` }}
        >
          {habit.icon.slice(0, 1).toUpperCase()}
        </div>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{habit.title}</h1>
          <p className="text-sm text-ink-3">Daily practice</p>
        </div>
      </section>
      <section className="my-6 flex items-end justify-between border-b border-line-soft pb-4">
        <div>
          <strong className="number block text-5xl font-bold leading-none text-streak">
            {stats.currentStreak}
          </strong>
          <span className="label mt-2 block">day streak</span>
        </div>
        <dl className="text-right">
          <dt className="label inline">Best </dt>
          <dd className="number inline text-lg">{stats.bestStreak}</dd>
          <br />
          <dt className="label inline">Completion </dt>
          <dd className="number inline text-lg">
            {Math.round((stats.completionRate ?? 0) * 100)}%
          </dd>
        </dl>
      </section>
      <section className="overflow-x-auto pb-3">
        <Heatmap points={heatPoints(today, entries)} />
      </section>
      <section className="card my-6 p-4">
        <h2 className="label mb-4">This week</h2>
        <WeekStrip compact days={weekDays(today, entries)} />
      </section>
      <section className="card p-4">
        <h2 className="mb-4 text-xl font-bold">Statistics</h2>
        <div className="grid grid-cols-3 gap-4">
          <Stat label="This month" value={`${done}/${month.length}`} />
          <Stat label="Skipped" value={String(skipped)} />
          <Stat label="Missed" value={String(missed)} danger />
        </div>
        <div className="mt-6">
          <p className="label mb-3">Completion by day</p>
          {["M", "T", "W", "T", "F", "S", "S"].map((letter, index) => (
            <div className="mb-2 flex items-center gap-2" key={index}>
              <span className="label w-3">{letter}</span>
              <div className="h-1.5 flex-1 rounded-full bg-surface-2">
                <div
                  className="h-full rounded-full bg-done"
                  style={{ width: `${Math.max(18, 90 - index * 9)}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      </section>
      <section className="my-6">
        <h2 className="mb-3 text-xl font-bold">Notes</h2>
        <div className="card px-5 py-7 text-center text-ink-3">
          Notes you add after a check-in will appear here.
        </div>
      </section>
      <form id="detail-action" action={markHabitAction.bind(null, userId, today)}>
        <input type="hidden" name="habitId" value={id} />
        <input type="hidden" name="intent" value="done" />
        <button className="primary" type="submit">
          Mark as done today
        </button>
      </form>
      <PrimaryActionAdapter formId="detail-action">Mark as done today</PrimaryActionAdapter>
    </main>
  );
}
function Stat({
  label,
  value,
  danger = false,
}: {
  label: string;
  value: string;
  danger?: boolean;
}) {
  return (
    <div>
      <span className="label block">{label}</span>
      <strong className={`number mt-1 block text-lg ${danger ? "text-miss" : ""}`}>{value}</strong>
    </div>
  );
}
