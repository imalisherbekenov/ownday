import { services, getCurrentUserId } from "@/lib/services";
import { markHabitAction } from "./actions";
import { EmptyState, WeekStrip } from "@ownday/ui";
import { HabitRowAdapter } from "@/components/habit-row-adapter";
import { PrimaryActionAdapter } from "@/components/primary-action-adapter";
import { weekDays } from "@/lib/view-data";
export const dynamic = "force-dynamic";
export default async function TodayPage() {
  const userId = await getCurrentUserId();
  const now = new Date();
  const items = await services.listHabitsForToday(userId, now);
  const today = items[0]?.localDate ?? (await services.localDateForUser(userId, now));
  const date = new Intl.DateTimeFormat("en", {
    weekday: "long",
    month: "long",
    day: "numeric",
  }).format(now);
  const action = markHabitAction.bind(null, userId, today);
  return (
    <main className="page">
      <header className="app-header flex items-end justify-between py-6">
        <div>
          <p className="label mb-1">{date}</p>
          <h1 className="text-[32px] font-extrabold leading-10 tracking-[-.03em]">Good evening</h1>
        </div>
        <span className="number text-sm text-ink-3">
          {items.filter((x) => x.entry?.status === "done").length}/{items.length}
        </span>
      </header>
      <section className="mb-6">
        <WeekStrip days={weekDays(today)} />
      </section>
      <section aria-labelledby="today-heading">
        <div className="mb-3 flex items-center justify-between">
          <h2 id="today-heading" className="text-xl font-bold">
            Today
          </h2>
          <span className="text-sm text-ink-3">Make it count</span>
        </div>
        {items.length ? (
          <div className="card divide-y divide-line-soft">
            {items.map(({ habit, entry, streak }) => (
              <HabitRowAdapter
                key={habit.id}
                id={habit.id}
                title={habit.title}
                type={habit.type}
                icon={habit.icon}
                color={habit.color}
                value={entry?.value ?? 0}
                target={habit.targetValue}
                unit={habit.unit}
                done={entry?.status === "done"}
                streak={streak.current}
                action={action}
              />
            ))}
          </div>
        ) : (
          <EmptyState />
        )}
      </section>
      <div className="mt-6">
        <PrimaryActionAdapter>Add a habit</PrimaryActionAdapter>
      </div>
    </main>
  );
}
