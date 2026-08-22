"use client";
import { useState, useTransition } from "react";
import Link from "next/link";
import type { Habit } from "@ownday/services";
import { StreakPill } from "./streak-pill";
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
  function drop(target: string) {
    if (!drag || drag === target) return;
    const next = [...items],
      from = next.findIndex((x) => x.id === drag),
      to = next.findIndex((x) => x.id === target),
      [moved] = next.splice(from, 1);
    if (!moved) return;
    next.splice(to, 0, moved);
    setItems(next);
    start(() => onReorder(next.map((x) => x.id)));
    setDrag(null);
  }
  return (
    <div className={`card divide-y divide-line-soft ${pending ? "opacity-70" : ""}`}>
      {items.map((h) => (
        <div
          key={h.id}
          draggable={!h.archivedAt}
          onDragStart={() => setDrag(h.id)}
          onDragOver={(e) => e.preventDefault()}
          onDrop={() => drop(h.id)}
          className={`flex min-h-[68px] items-center gap-3 px-4 py-3 ${h.archivedAt ? "opacity-60" : ""}`}
        >
          <button type="button" aria-label="Перетащить" className="min-h-11 min-w-11 text-ink-3">
            ⠿
          </button>
          <span
            className="flex h-10 w-10 items-center justify-center rounded-input bg-surface-2"
            style={{ color: `var(--color-hue-${h.color})` }}
          >
            {h.icon.slice(0, 1).toUpperCase()}
          </span>
          <Link href={`/habit/${h.id}`} className="min-w-0 flex-1">
            <b className="block truncate">{h.title}</b>
            <span className="text-sm text-ink-3">{scheduleLabel(h)}</span>
          </Link>
          {h.archivedAt ? (
            <button
              className="min-h-11 text-sm font-bold text-done-ink"
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
