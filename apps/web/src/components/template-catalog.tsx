"use client";
import { useMemo, useState } from "react";
import Link from "next/link";
import type { HabitTemplate } from "@ownday/services";
import { useInterfaceLocale } from "./interface-locale";
import { JournalIcon } from "./journal-icon";
export function TemplateCatalog({ templates }: { templates: HabitTemplate[] }) {
  const { t } = useInterfaceLocale();
  const [query, setQuery] = useState(""),
    [category, setCategory] = useState<string | null>(null);
  const categories = [...new Set(templates.map((item) => item.category))];
  const shown = useMemo(
    () =>
      templates.filter(
        (item) =>
          (category === null || item.category === category) &&
          item.title.toLocaleLowerCase().includes(query.toLocaleLowerCase()),
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
        placeholder={t("Найти шаблон", "Find a template")}
        aria-label={t("Поиск шаблонов", "Search templates")}
      />
      <div className="journal-controls mb-4">
        {[null, ...categories].map((c) => (
          <button
            key={c ?? "all"}
            className="journal-button aria-pressed:bg-done-soft"
            aria-pressed={category === c}
            onClick={() => setCategory(c)}
          >
            {c ?? t("Все", "All")}
          </button>
        ))}
      </div>
      <div className="card divide-y divide-line-soft">
        {shown.map((item) => (
          <div key={item.id} className="flex min-h-20 items-center gap-3 p-4">
            <span className="journal-marker shrink-0">
              <JournalIcon name={item.icon} />
            </span>
            <div className="min-w-0 flex-1">
              <b className="block break-words">{item.title}</b>
              <span className="text-sm text-ink-3">{item.category}</span>
            </div>
            <Link
              href={`/habits/new?template=${encodeURIComponent(item.id)}`}
              className="journal-button"
              aria-label={t("Выбрать: ", "Choose: ") + item.title}
            >
              +
            </Link>
          </div>
        ))}
        {!shown.length && (
          <p className="p-8 text-center">{t("Ничего не найдено", "No templates found")}</p>
        )}
      </div>
    </>
  );
}
