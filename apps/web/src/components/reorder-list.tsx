"use client";
import { useState, useTransition } from "react";
import Link from "next/link";
import type { Habit } from "@ownday/services";
import { StreakPill } from "@ownday/ui";
export function ReorderList({
  habits,
  streaks,
  onReorder,
  onRestore,
}: {
  habits: Habit[];
  streaks: Record<string, number>;
  onReorder: (ids: string[]) => Promise<void>;
  onRestore: (id: string) => Promise<void>;
}) {
  const [items, setItems] = useState(habits),
    [drag, setDrag] = useState<string | null>(null),
    [pending, start] = useTransition();
  function commit(next: Habit[]) {
    setItems(next);
    start(() => onReorder(next.map((x) => x.id)));
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
    <div className={`card divide-y divide-line-soft ${pending ? "opacity-70" : ""}`}>
      {items.map((h, index) => (
        <div
          key={h.id}
          draggable={!h.archivedAt}
          onDragStart={() => setDrag(h.id)}
          onDragOver={(e) => e.preventDefault()}
          onDrop={() => drop(h.id)}
          className={`flex min-h-[68px] items-center gap-2 px-3 py-3 ${h.archivedAt ? "opacity-60" : ""}`}
        >
          {h.archivedAt ? null : (
            <div className="flex shrink-0">
              <Move
                label={`Поднять «${h.title}»`}
                disabled={index === 0}
                onMove={() => shift(h.id, -1)}
              >
                ↑
              </Move>
              <Move
                label={`Опустить «${h.title}»`}
                disabled={index === items.length - 1}
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
            {h.icon.slice(0, 1).toUpperCase()}
          </span>
          <Link href={`/habit/${h.id}`} className="min-w-0 flex-1">
            <b className="block truncate">{h.title}</b>
            <span className="block truncate text-sm text-ink-3">{scheduleLabel(h)}</span>
          </Link>
          {h.archivedAt ? (
            <button
              className="min-h-11 shrink-0 text-sm font-bold text-done-ink"
              onClick={() => start(() => onRestore(h.id))}
            >
              Вернуть
            </button>
          ) : (
            <StreakPill streak={streaks[h.id] ?? 0} />
          )}
        </div>
      ))}
    </div>
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
function scheduleLabel(h: Habit) {
  const k = h.scheduleVersions.at(-1)?.schedule.kind;
  return k === "daily"
    ? "Каждый день"
    : k === "days_of_week"
      ? "По выбранным дням"
      : k === "times_per_week"
        ? "Несколько раз в неделю"
        : "По интервалу";
}
