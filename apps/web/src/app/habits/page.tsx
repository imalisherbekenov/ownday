import Link from "next/link";
import * as Tabs from "@radix-ui/react-tabs";
import { getCurrentUserId, services } from "@/lib/services";
import { ReorderList } from "@/components/reorder-list";
import { reorderHabitsAction, restoreAction } from "./actions";
export const dynamic = "force-dynamic";
export default async function HabitsPage({
  searchParams,
}: {
  searchParams: Promise<{ view?: string }>;
}) {
  const { view } = await searchParams,
    userId = await getCurrentUserId(),
    all = await services.listHabits(userId, true),
    archived = view === "archive",
    shown = all.filter((h) => Boolean(h.archivedAt) === archived),
    stats = await Promise.all(shown.map((h) => services.getHabitStats(h.id)));
  const streaks = Object.fromEntries(stats.map((s) => [s.habitId, s.currentStreak]));
  return (
    <main className="page py-6">
      <header className="app-header mb-6">
        <p className="label">Библиотека</p>
        <h1 className="text-[32px] font-extrabold tracking-[-.03em]">Все привычки</h1>
      </header>
      <Tabs.Root value={archived ? "archive" : "active"} className="mb-4">
        <Tabs.List className="segments grid-cols-2">
          <Tabs.Trigger asChild value="active" className="segment">
            <Link href="/habits">
              Активные <span className="number">{all.filter((h) => !h.archivedAt).length}</span>
            </Link>
          </Tabs.Trigger>
          <Tabs.Trigger asChild value="archive" className="segment">
            <Link href="/habits?view=archive">
              В архиве <span className="number">{all.filter((h) => h.archivedAt).length}</span>
            </Link>
          </Tabs.Trigger>
        </Tabs.List>
      </Tabs.Root>
      {shown.length ? (
        <ReorderList
          habits={shown}
          streaks={streaks}
          onReorder={reorderHabitsAction}
          onRestore={restoreAction}
        />
      ) : (
        <div className="card p-8 text-center text-ink-3">Здесь пока пусто.</div>
      )}
      <p className="mt-3 text-sm text-ink-3">
        Зажмите ручку и перетащите строку, чтобы изменить порядок.
      </p>
      <Link href="/habits/new" className="primary mt-6 flex items-center justify-center">
        Добавить привычку
      </Link>
    </main>
  );
}
