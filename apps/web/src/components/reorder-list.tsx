"use client";
import { useState, useTransition } from "react";
import Link from "next/link";
import type { Habit } from "@ownday/services";
import { useInterfaceLocale } from "./interface-locale";
import { JournalIcon } from "./journal-icon";
import { StreakPill } from "@ownday/ui";
export function ReorderList({
  habits,
  streaks,
  onReorder,
  onRestore,
  onDelete,
}: {
  habits: Habit[];
  streaks: Record<string, number>;
  onReorder: (ids: string[]) => Promise<void>;
  onRestore: (id: string) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
}) {
  const { t } = useInterfaceLocale();
  const [query, setQuery] = useState("");
  const [error, setError] = useState(false);
  const [items, setItems] = useState(habits),
    [seen, setSeen] = useState(habits),
    [confirming, setConfirming] = useState<string | null>(null),
    [drag, setDrag] = useState<string | null>(null),
    [pending, start] = useTransition();
  // Список живёт в состоянии, чтобы перестановка отзывалась мгновенно, — но тогда
  // ответ сервера до него не доходит: вернули привычку из архива, а строка осталась
  // висеть до полной перезагрузки. Сверяем ссылку на пришедший список и принимаем его.
  if (seen !== habits) {
    setSeen(habits);
    setItems(habits);
    setConfirming(null);
  }
  function commit(next: Habit[]) {
    const previous = items;
    setError(false);
    setItems(next);
    start(async () => {
      try {
        await onReorder(next.map((x) => x.id));
      } catch {
        setItems(previous);
        setError(true);
      }
    });
  }
  function drop(target: string) {
    if (!drag || drag === target) return;
    const next = [...items],
      from = next.findIndex((x) => x.id === drag),
      to = next.findIndex((x) => x.id === target),
      [moved] = next.splice(from, 1);
    if (!moved) return;
    next.splice(to, 0, moved);
    commit(next);
    setDrag(null);
  }
  // Перетаскивание — событие мыши: на телефоне dragstart не возникает вовсе, а с
  // клавиатуры его не вызвать ничем. Раз телефон здесь основная поверхность, порядок
  // обязан меняться и без него — стрелками, которые одинаково доступны пальцу,
  // курсору и Tab. Перетаскивание остаётся там, где работало.
  function shift(id: string, delta: -1 | 1) {
    const next = [...items],
      from = next.findIndex((x) => x.id === id),
      to = from + delta,
      moved = next[from],
      displaced = next[to];
    if (!moved || !displaced) return;
    next[from] = displaced;
    next[to] = moved;
    commit(next);
  }
  return (
    <>
      {error && (
        <p role="alert" className="journal-message">
          {t(
            "Не удалось сохранить изменение. Обнови страницу и повтори.",
            "Could not save this change. Refresh the page and try again.",
          )}
        </p>
      )}
      <input
        className="control mb-4"
        type="search"
        aria-label={t("Поиск привычек", "Search habits")}
        placeholder={t("Найти свою привычку", "Find your habit")}
        value={query}
        onChange={(event) => setQuery(event.target.value)}
      />
      <div className={`card divide-y divide-line-soft ${pending ? "opacity-70" : ""}`}>
        {items.map(
          (h, index) =>
            h.title.toLocaleLowerCase().includes(query.toLocaleLowerCase()) && (
              <div
                key={h.id}
                draggable={!h.archivedAt && !pending && !query}
                onDragStart={() => setDrag(h.id)}
                onDragOver={(e) => e.preventDefault()}
                onDrop={() => drop(h.id)}
                className={`flex flex-wrap min-h-[68px] items-center gap-2 px-3 py-3 ${h.archivedAt ? "opacity-80" : ""}`}
              >
                {h.archivedAt ? null : (
                  <div className="flex shrink-0">
                    <Move
                      label={t(`Поднять «${h.title}»`, `Move ${h.title} up`)}
                      disabled={pending || index === 0 || Boolean(query)}
                      onMove={() => shift(h.id, -1)}
                    >
                      ↑
                    </Move>
                    <Move
                      label={t(`Опустить «${h.title}»`, `Move ${h.title} down`)}
                      disabled={pending || index === items.length - 1 || Boolean(query)}
                      onMove={() => shift(h.id, 1)}
                    >
                      ↓
                    </Move>
                  </div>
                )}
                <span
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-input bg-surface-2"
                  style={{ color: `var(--color-hue-${h.color})` }}
                >
                  <JournalIcon name={h.icon} />
                </span>
                <Link href={`/habit/${h.id}`} className="min-w-0 flex-1">
                  <b className="block break-words">{h.title}</b>
                  <span className="block truncate text-sm text-ink-3">{scheduleLabel(h, t)}</span>
                </Link>
                {h.archivedAt ? (
                  <div className="flex w-full justify-end flex-wrap items-center gap-1">
                    {confirming === h.id ? (
                      <>
                        <button
                          className="min-h-11 px-2 text-sm font-bold text-ink-3"
                          onClick={() => setConfirming(null)}
                        >
                          {t("Отмена", "Cancel")}
                        </button>
                        <button
                          className="min-h-11 px-2 text-sm font-bold text-miss"
                          onClick={() => {
                            setConfirming(null);
                            start(async () => {
                              try {
                                await onDelete(h.id);
                              } catch {
                                setError(true);
                              }
                            });
                          }}
                        >
                          {t("Удалить насовсем", "Delete permanently")}
                        </button>
                      </>
                    ) : (
                      <>
                        <Link
                          className="min-h-11 px-2 text-sm font-bold text-done-ink"
                          href={`/habits/${h.id}/edit`}
                        >
                          {t("Вернуть", "Restore")}
                        </Link>
                        {/* Второе нажатие — вся защита, какая тут есть, и её достаточно:
                      привычка уже отложена в архив, то есть это второй шаг, а не первый. */}
                        <button
                          className="min-h-11 px-2 text-sm font-bold text-ink-3"
                          onClick={() => setConfirming(h.id)}
                        >
                          {t("Удалить", "Delete")}
                        </button>
                      </>
                    )}
                  </div>
                ) : (
                  <StreakPill streak={streaks[h.id] ?? 0} />
                )}
              </div>
            ),
        )}
      </div>
    </>
  );
}
function Move({
  label,
  disabled,
  onMove,
  children,
}: {
  label: string;
  disabled: boolean;
  onMove: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      disabled={disabled}
      onClick={onMove}
      className="flex min-h-11 min-w-11 items-center justify-center text-ink-3 disabled:opacity-30"
    >
      {children}
    </button>
  );
}
function scheduleLabel(h: Habit, t: (ru: string, en: string) => string) {
  const k = h.scheduleVersions.at(-1)?.schedule.kind;
  return k === "daily"
    ? t("Каждый день", "Every day")
    : k === "days_of_week"
      ? t("По выбранным дням", "Selected weekdays")
      : k === "times_per_week"
        ? t("Несколько раз в неделю", "Weekly goal")
        : t("По интервалу", "Custom schedule");
}
