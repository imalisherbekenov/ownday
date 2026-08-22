"use client";
import { useMemo, useState, useTransition } from "react";
import type { HabitTemplate } from "@ownday/services";
export function TemplateCatalog({
  templates,
  onAdd,
}: {
  templates: HabitTemplate[];
  onAdd: (t: HabitTemplate) => Promise<void>;
}) {
  const [query, setQuery] = useState(""),
    [category, setCategory] = useState("Все"),
    [pending, start] = useTransition(),
    categories = ["Все", ...new Set(templates.map((t) => t.category))],
    shown = useMemo(
      () =>
        templates.filter(
          (t) =>
            (category === "Все" || t.category === category) &&
            t.title.toLowerCase().includes(query.toLowerCase()),
        ),
      [templates, category, query],
    );
  return (
    <>
      <input
        className="control mb-4"
        type="search"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Найти шаблон"
        aria-label="Поиск шаблонов"
      />
      <div className="mb-4 flex gap-2 overflow-x-auto pb-1">
        {categories.map((c) => (
          <button
            key={c}
            onClick={() => setCategory(c)}
            aria-pressed={category === c}
            className="min-h-11 shrink-0 rounded-full bg-surface-2 px-4 text-sm aria-pressed:bg-done-soft aria-pressed:text-done-ink"
          >
            {c}
          </button>
        ))}
      </div>
      <div className="card divide-y divide-line-soft">
        {shown.map((t) => (
          <div key={t.id} className="flex min-h-[68px] items-center gap-3 px-4 py-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-input bg-surface-2">
              {t.icon.slice(0, 1).toUpperCase()}
            </span>
            <div className="min-w-0 flex-1">
              <b className="block truncate">{t.title}</b>
              <span className="text-sm text-ink-3">{t.category}</span>
            </div>
            <button
              disabled={pending}
              onClick={() => start(() => onAdd(t))}
              className="min-h-11 min-w-11 rounded-full bg-ink text-surface"
              aria-label={`Добавить ${t.title}`}
            >
              +
            </button>
          </div>
        ))}
        {shown.length === 0 && <p className="p-8 text-center text-ink-3">Ничего не найдено</p>}
      </div>
    </>
  );
}
