import { interfaceLocale } from "@/lib/interface-locale";
import Link from "next/link";
import * as Tabs from "@radix-ui/react-tabs";
import { getCurrentUserId, services } from "@/lib/services";
import { ReorderList } from "@/components/reorder-list";
import { deleteHabitAction, reorderHabitsAction, restoreAction } from "./actions";
export const dynamic = "force-dynamic";
export default async function HabitsPage({
  searchParams,
}: {
  searchParams: Promise<{ view?: string }>;
}) {
  const locale = await interfaceLocale(),
    t = (ru: string, en: string) => (locale === "ru" ? ru : en);
  const { view } = await searchParams,
    userId = await getCurrentUserId(),
    all = await services.listHabits(userId, true),
    archived = view === "archive",
    shown = all.filter((h) => Boolean(h.archivedAt) === archived),
    stats = await Promise.all(shown.map((h) => services.getHabitStats(h.id, userId)));
  const streaks = Object.fromEntries(stats.map((s) => [s.habitId, s.currentStreak]));
  return (
    <main className="page py-6">
      <header className="app-header journal-heading">
        <p className="label">{t("Библиотека", "Your collection")}</p>
        <h1 className="text-[32px] font-extrabold tracking-[-.03em]">
          {t("Все привычки", "Little things, your way.")}
        </h1>
      </header>
      <Tabs.Root value={archived ? "archive" : "active"} className="mb-4">
        <Tabs.List className="segments grid-cols-2">
          <Tabs.Trigger asChild value="active" className="segment">
            <Link href="/habits">
              {t("Активные", "Active")}{" "}
              <span className="number">{all.filter((h) => !h.archivedAt).length}</span>
            </Link>
          </Tabs.Trigger>
          <Tabs.Trigger asChild value="archive" className="segment">
            <Link href="/habits?view=archive">
              {t("В архиве", "Archived")}{" "}
              <span className="number">{all.filter((h) => h.archivedAt).length}</span>
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
          onDelete={deleteHabitAction}
        />
      ) : (
        <div className="card flex flex-col items-center gap-4 p-8 text-center text-ink-3">
          {t("Здесь пока пусто.", "Nothing here yet.")}
          <Link className="primary max-w-xs" href="/templates">
            {t("Выбрать из шаблонов", "Choose a template")}
          </Link>
        </div>
      )}
      <p className="mt-3 text-sm text-ink-3">
        {t(
          "Порядок меняется стрелками, а на компьютере строку можно перетащить.",
          "Use the arrows to reorder, or drag a habit on a computer.",
        )}
      </p>
      <Link href="/habits/new" className="primary mt-6 flex items-center justify-center">
        {t("Добавить привычку", "Add a habit")}
      </Link>
    </main>
  );
}
