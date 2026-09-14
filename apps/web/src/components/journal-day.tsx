"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  assertSyncOperation,
  isDue,
  localDateFor,
  scheduleAt,
  transitionEntry,
  computeStreak,
  completionTotals,
  withInactiveDays,
} from "@ownday/core";
import type {
  EntryAction,
  EntrySnapshot,
  HabitSnapshot,
  SyncOperation,
  SyncResult,
  SyncSnapshot,
} from "@ownday/core";
import { applyJournalOperation } from "@/app/journal-actions";
import { shiftDate } from "@/lib/view-data";
import { JournalIcon } from "./journal-icon";
import { useInterfaceLocale } from "./interface-locale";
import { useTelegram } from "./telegram-provider";
type Conflict = { operation: SyncOperation; result: SyncResult; intended: EntrySnapshot | null };
export function JournalDay({
  initial,
  initialDate,
  habitId,
}: {
  initial: SyncSnapshot;
  initialDate: string;
  habitId?: string;
}) {
  const [model, setModel] = useState(initial),
    [date, setDate] = useState(initialDate),
    [today, setToday] = useState(() =>
      localDateFor(new Date(), initial.preferences.timezone, initial.preferences.dayStartHour),
    );
  const [pending, setPending] = useState<SyncOperation | null>(null),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(false),
    [conflict, setConflict] = useState<Conflict | null>(null);
  const [editing, setEditing] = useState<string | null>(null),
    [amount, setAmount] = useState(""),
    [amountError, setAmountError] = useState(false);
  const { locale, t } = useInterfaceLocale(),
    telegram = useTelegram();
  const storageKey = `ownday.web.pending:${initial.userId}`;
  const intendedById = useRef(new Map<string, EntrySnapshot | null>());
  useEffect(() => {
    try {
      const raw = sessionStorage.getItem(storageKey);
      if (raw) {
        const stored = JSON.parse(raw),
          op = stored.operation ?? stored;
        assertSyncOperation(op);
        if (stored.intended !== undefined)
          intendedById.current.set(op.change.operationId, stored.intended);
        setPending(op);
        setError(true);
      }
    } catch {
      setError(true);
    }
  }, [storageKey]);
  useEffect(() => {
    const timer = setInterval(() => {
      const next = localDateFor(
        new Date(),
        initial.preferences.timezone,
        initial.preferences.dayStartHour,
      );
      setToday((old) => {
        if (old !== next) setDate((d) => (d === old ? next : d));
        return next;
      });
    }, 30000);
    return () => clearInterval(timer);
  }, [initial.preferences]);
  const due = (habit: HabitSnapshot, day: string) =>
    day >= habit.startedOn &&
    !habit.inactiveRanges.some(
      (range) => day >= range.from && (range.through === null || day < range.through),
    ) &&
    isDue(scheduleAt(habit.scheduleVersions, day), day);
  const selected = habitId ? model.habits.find((h) => h.id === habitId) : undefined;
  const habits = model.habits.filter(
    (habit) => (!habitId || habit.id === habitId) && due(habit, date),
  );
  const entryFor = (id: string, day = date) =>
    model.entries.find((entry) => entry.habitId === id && entry.localDate === day);
  const done = habits.filter((h) => {
    const e = entryFor(h.id);
    return !e?.deleted && e?.status === "done";
  }).length;
  const total = habits.filter((h) => entryFor(h.id)?.status !== "skip").length;
  const monday = shiftDate(date, -((new Date(date + "T12:00:00Z").getUTCDay() + 6) % 7));
  const format = (day: string, options: Intl.DateTimeFormatOptions) =>
    new Intl.DateTimeFormat(locale === "ru" ? "ru-RU" : "en-GB", {
      timeZone: "UTC",
      ...options,
    }).format(new Date(day + "T12:00:00Z"));
  function receive(result: SyncResult, operation?: SyncOperation) {
    if (result.kind !== "entry") return;
    if (result.reason === "HABIT_DELETED" && operation?.kind === "entry") {
      setModel((old) => ({
        ...old,
        habits: old.habits.filter((h) => h.id !== operation.change.habitId),
        entries: old.entries.filter((e) => e.habitId !== operation.change.habitId),
      }));
      return;
    }
    setModel((old) => ({
      ...old,
      entries: [
        ...old.entries.filter((e) =>
          result.entry
            ? e.habitId !== result.entry.habitId || e.localDate !== result.entry.localDate
            : true,
        ),
        ...(result.entry ? [result.entry] : []),
      ],
    }));
  }
  async function send(operation: SyncOperation) {
    if (busy) return;
    setBusy(true);
    setError(false);
    setPending(operation);
    try {
      const change = operation.kind === "entry" ? operation.change : null;
      const habit = change ? model.habits.find((h) => h.id === change.habitId) : null;
      const current = change ? (entryFor(change.habitId, change.localDate) ?? null) : null;
      if (!intendedById.current.has(operation.change.operationId)) {
        const value =
          change && habit
            ? transitionEntry(current, { ...change, baseRevision: current?.revision ?? 0 }, habit)
            : null;
        intendedById.current.set(
          operation.change.operationId,
          value && change
            ? {
                ...value,
                id: current?.id ?? crypto.randomUUID(),
                habitId: change.habitId,
                localDate: change.localDate,
              }
            : null,
        );
      }
      const intended = intendedById.current.get(operation.change.operationId) ?? null;
      if (operation.kind === "entry" && intended && !operation.change.clientIntent)
        operation = {
          ...operation,
          change: {
            ...operation.change,
            clientIntent: {
              value: intended.value,
              status: intended.status,
              deleted: intended.deleted,
            },
          },
        };
      setPending(operation);
      sessionStorage.setItem(storageKey, JSON.stringify({ operation, intended }));
      const result = await applyJournalOperation(initial.userId, operation);
      if (result.outcome === "conflict") {
        setConflict({
          operation,
          result,
          intended,
        });
      } else {
        receive(result);
        setPending(null);
        setConflict(null);
        sessionStorage.removeItem(storageKey);
        telegram.webApp?.HapticFeedback?.impactOccurred("light");
      }
    } catch {
      setError(true);
    } finally {
      setBusy(false);
    }
  }
  function mark(habit: HabitSnapshot, action: EntryAction) {
    if (pending || busy || date > today) return;
    void send({
      kind: "entry",
      change: {
        operationId: crypto.randomUUID(),
        habitId: habit.id,
        localDate: date,
        baseRevision: entryFor(habit.id)?.revision ?? 0,
        action,
      },
    });
  }
  function choose(useOwn: boolean) {
    if (!conflict || busy) return;
    const { operation, result, intended } = conflict;
    if (useOwn && intended && operation.kind === "entry" && result.kind === "entry") {
      receive(result, operation);
      setConflict(null);
      setPending(null);
      void send({
        kind: "entry",
        change: {
          operationId: crypto.randomUUID(),
          habitId: intended.habitId,
          localDate: intended.localDate,
          baseRevision: result.revision,
          action: intended.deleted
            ? { kind: "clear" }
            : { kind: "set", status: intended.status, value: intended.value },
        },
      });
    } else {
      receive(result, operation);
      setConflict(null);
      setPending(null);
      sessionStorage.removeItem(storageKey);
    }
  }
  return (
    <main className="page journal-page">
      <header className="journal-heading">
        {habitId && (
          <Link className="journal-button mb-4" href="/habits">
            ← {t("Мои привычки", "My habits")}
          </Link>
        )}
        <p className="label">{format(date, { weekday: "long", day: "numeric", month: "long" })}</p>
        <h1>
          {habitId
            ? (selected?.title ?? t("Привычка удалена", "Habit deleted"))
            : t("Сегодня — в твоём ритме.", "Today, at your own pace.")}
        </h1>
        <p>
          {t(
            "Не нужно успевать всё. Начни с того, что важно тебе.",
            "You do not need to do everything. Start with what matters to you.",
          )}
        </p>
      </header>
      {selected && (
        <HabitHistory
          habit={selected}
          entries={model.entries.filter((e) => e.habitId === selected.id)}
          date={date}
          today={today}
          select={setDate}
        />
      )}
      {!habitId && (
        <section className="journal-week card" aria-label={t("Выбрать день", "Choose a day")}>
          <div className="journal-between">
            <button
              className="journal-button"
              onClick={() => setDate(shiftDate(date, -7))}
              aria-label={t("Предыдущая неделя", "Previous week")}
            >
              ←
            </button>
            <button className="journal-button" onClick={() => setDate(today)}>
              {t("Сегодня", "Today")}
            </button>
            <button
              className="journal-button"
              onClick={() => setDate(shiftDate(date, 7))}
              aria-label={t("Следующая неделя", "Next week")}
            >
              →
            </button>
          </div>
          <div className="journal-days">
            {Array.from({ length: 7 }, (_, i) => shiftDate(monday, i)).map((day) => (
              <button
                key={day}
                aria-pressed={date === day}
                className="journal-date"
                onClick={() => setDate(day)}
                aria-label={format(day, { weekday: "long", day: "numeric", month: "long" })}
              >
                <span>{format(day, { weekday: "short" })}</span>
                <b>{Number(day.slice(8))}</b>
                <small>
                  {model.entries.some(
                    (e) => e.localDate === day && !e.deleted && e.status === "done",
                  )
                    ? "✓"
                    : "·"}
                </small>
              </button>
            ))}
          </div>
        </section>
      )}
      <div className="journal-between journal-section-title">
        <h2>
          {habitId ? t("Отметка за день", "Daily check-in") : t("Мой день", "My day")}{" "}
          <span className="text-ink-3">
            · {done}/{total}
          </span>
        </h2>
        {!habitId && (
          <Link
            className="journal-button"
            href="/habits/new"
            aria-label={t("Добавить привычку", "Add a habit")}
          >
            <JournalIcon name="plus" />
          </Link>
        )}
      </div>
      {date > today && (
        <p className="journal-message">
          {t(
            "Будущие дни доступны для просмотра. Отметки можно сделать, когда наступит день.",
            "Future days are for planning. You can check in when the day arrives.",
          )}
        </p>
      )}
      {error && (
        <div className="journal-message" role="alert">
          <p>
            {t(
              "Не удалось подтвердить изменение. Повтор использует ту же операцию и не создаст дубль.",
              "The change could not be confirmed. Retrying uses the same operation without duplicating it.",
            )}
          </p>
          {pending && (
            <button className="journal-button" disabled={busy} onClick={() => void send(pending)}>
              {t("Повторить", "Retry")}
            </button>
          )}
        </div>
      )}
      {conflict && (
        <section
          className="card journal-habit"
          aria-label={t("Конфликт изменений", "Conflicting changes")}
        >
          <h2>{t("Сохраним твой выбор", "Keep your choice")}</h2>
          <p>
            {t(
              "На другом устройстве уже есть изменение. Обе версии сохранены.",
              "Another device has a change. Both versions are preserved.",
            )}
          </p>
          <p>
            {t("Твоё значение", "Your value")}: {conflict.intended?.value ?? 0} ·{" "}
            {t("На сервере", "On the server")}:{" "}
            {conflict.result.kind === "entry" ? (conflict.result.entry?.value ?? 0) : "—"}
          </p>
          <div className="journal-controls">
            <button className="journal-button" onClick={() => choose(false)}>
              {t("Оставить серверное", "Keep server value")}
            </button>
            {!["HABIT_DELETED", "HABIT_NOT_DUE", "ENTRY_OUT_OF_RANGE"].includes(
              conflict.result.reason ?? "",
            ) && (
              <button className="journal-button" onClick={() => choose(true)}>
                {t("Применить моё", "Use my value")}
              </button>
            )}
          </div>
        </section>
      )}
      {(["morning", "afternoon", "evening"] as const).map((time) => {
        const group = habits.filter((h) => h.time === time);
        return (
          group.length > 0 && (
            <section className="journal-group" key={time}>
              <h3 className="label">
                {time === "morning"
                  ? t("Утро", "Morning")
                  : time === "afternoon"
                    ? t("День", "Afternoon")
                    : t("Вечер", "Evening")}
              </h3>
              {group.map((habit) => {
                const entry = entryFor(habit.id),
                  value = entry?.deleted ? 0 : (entry?.value ?? 0),
                  complete = !entry?.deleted && entry?.status === "done",
                  skip = !entry?.deleted && entry?.status === "skip",
                  disabled = busy || pending !== null || date > today,
                  target = habit.targetValue ?? 1;
                return (
                  <article className="card journal-habit" key={habit.id}>
                    <div className="journal-habit-title">
                      <span className="journal-marker">
                        <JournalIcon name={habit.icon} />
                      </span>
                      <Link href={`/habit/${habit.id}`}>
                        <b>{habit.title}</b>
                        <span>
                          {skip
                            ? t("Осознанный пропуск", "Intentional pause")
                            : habit.type === "binary"
                              ? complete
                                ? t("Выполнено", "Done")
                                : t("Один маленький шаг", "One little step")
                              : `${new Intl.NumberFormat(locale).format(value)} / ${new Intl.NumberFormat(locale).format(target)} ${habit.unit}`}
                        </span>
                      </Link>
                    </div>
                    {habit.type !== "binary" && !skip && (
                      <progress value={value} max={target} aria-label={habit.title} />
                    )}
                    <div className="journal-controls">
                      {habit.type !== "binary" && (
                        <>
                          <button
                            className="journal-button"
                            disabled={disabled}
                            onClick={() => {
                              setEditing(habit.id);
                              setAmountError(false);
                              setAmount(String(value));
                            }}
                          >
                            {t("Ввести число", "Enter amount")}
                          </button>
                          <button
                            className="journal-button"
                            disabled={disabled || value <= 0 || skip}
                            aria-label={t("Уменьшить: ", "Decrease: ") + habit.title}
                            onClick={() =>
                              mark(habit, {
                                kind: "increment",
                                delta: habit.type === "duration" ? -5 : -1,
                              })
                            }
                          >
                            −
                          </button>
                          <button
                            className="journal-button"
                            disabled={disabled || skip}
                            aria-label={t("Увеличить: ", "Increase: ") + habit.title}
                            onClick={() =>
                              mark(habit, {
                                kind: "increment",
                                delta: habit.type === "duration" ? 5 : 1,
                              })
                            }
                          >
                            +
                          </button>
                        </>
                      )}
                      <button
                        className="journal-button"
                        disabled={disabled}
                        aria-label={
                          (complete ? t("Отменить: ", "Undo: ") : t("Выполнить: ", "Complete: ")) +
                          habit.title
                        }
                        onClick={() =>
                          mark(
                            habit,
                            complete ? { kind: "clear" } : { kind: "set", status: "done" },
                          )
                        }
                      >
                        {complete ? "✓ " : ""}
                        {complete ? t("Отменить", "Undo") : t("Отметить", "Check in")}
                      </button>
                      <button
                        className="journal-button"
                        disabled={disabled}
                        onClick={() => mark(habit, skip ? { kind: "unskip" } : { kind: "skip" })}
                      >
                        {skip ? t("Вернуть", "Undo skip") : t("Пропустить", "Skip")}
                      </button>
                    </div>
                    {editing === habit.id && (
                      <form
                        className="journal-controls"
                        onSubmit={(event) => {
                          event.preventDefault();
                          const value = Number(amount.replace(",", "."));
                          if (
                            !Number.isFinite(value) ||
                            value < 0 ||
                            value > 999999999.999 ||
                            Math.abs(value * 1000 - Math.round(value * 1000)) > 0.0001
                          ) {
                            setAmountError(true);
                            return;
                          }
                          setEditing(null);
                          mark(habit, { kind: "set", status: "done", value });
                        }}
                      >
                        <label>
                          {t("Количество", "Amount")}
                          <input
                            autoFocus
                            required
                            className="control"
                            inputMode="decimal"
                            value={amount}
                            onChange={(e) => setAmount(e.target.value)}
                          />
                        </label>
                        <button className="journal-button" type="submit">
                          {t("Сохранить", "Save")}
                        </button>
                        <button
                          className="journal-button"
                          type="button"
                          onClick={() => setEditing(null)}
                        >
                          {t("Отмена", "Cancel")}
                        </button>
                        {amountError && (
                          <p role="alert">
                            {t(
                              "Введи число от 0 до 999999999,999, не более трёх знаков после запятой.",
                              "Enter 0 to 999999999.999, with up to three decimal places.",
                            )}
                          </p>
                        )}
                      </form>
                    )}
                  </article>
                );
              })}
            </section>
          )
        );
      })}
      {!habits.length && habitId && (
        <p className="journal-message">
          {t(
            "На этот день привычка не запланирована или находится в архиве.",
            "This habit is not scheduled for this day, or is archived.",
          )}
        </p>
      )}
      {!habits.length && !habitId && (
        <section className="card journal-empty">
          <JournalIcon name="leaf" className="h-16 w-16" />
          <h2>
            {model.habits.length
              ? t("Место для паузы", "Room for a pause")
              : t("Всё начинается с одной привычки", "It starts with one habit")}
          </h2>
          <p>
            {t(
              "Стакан воды. Несколько страниц. Что сделает твой день немного лучше?",
              "A glass of water. A few pages. What would make your day a little better?",
            )}
          </p>
          <Link className="journal-button" href="/habits/new">
            {t("Создать привычку", "Create a habit")}
          </Link>
          <Link href="/templates">{t("Выбрать шаблон", "Choose a template")}</Link>
        </section>
      )}
      {total > 0 && done === total && (
        <p className="journal-message">
          {t(
            "На сегодня достаточно. Ты уже сделал шаг для себя.",
            "Enough for today. You have taken a step for yourself.",
          )}
        </p>
      )}
      <p className="journal-footnote">
        {t(
          "Пауза — тоже часть пути. Пропуск не прерывает серию.",
          "A pause is part of the journey. Skipping does not break your streak.",
        )}
      </p>
    </main>
  );
}

function HabitHistory({
  habit,
  entries,
  date,
  today,
  select,
}: {
  habit: HabitSnapshot;
  entries: EntrySnapshot[];
  date: string;
  today: string;
  select: (date: string) => void;
}) {
  const { t, locale } = useInterfaceLocale();
  const from = date.slice(0, 7) + "-01",
    end = new Date(Date.UTC(Number(date.slice(0, 4)), Number(date.slice(5, 7)), 0))
      .toISOString()
      .slice(0, 10);
  const history = withInactiveDays(
    entries.filter((e) => !e.deleted),
    habit.inactiveRanges,
    habit.startedOn,
    today,
  );
  const streak = computeStreak({
    versions: habit.scheduleVersions,
    entries: history,
    startedOn: habit.startedOn,
    today,
  });
  const totals = completionTotals({
    versions: habit.scheduleVersions,
    entries: history,
    startedOn: from > habit.startedOn ? from : habit.startedOn,
    today: end < today ? end : today,
  });
  const unit = (count: number) => {
    const forms =
      streak.unit === "week"
        ? ["неделя", "недели", "недель"]
        : streak.unit === "month"
          ? ["месяц", "месяца", "месяцев"]
          : ["день", "дня", "дней"];
    const plural = new Intl.PluralRules("ru").select(count);
    return locale === "ru"
      ? forms[plural === "one" ? 0 : plural === "few" ? 1 : 2]
      : `${streak.unit}${count === 1 ? "" : "s"}`;
  };
  const first = (new Date(from + "T12:00:00Z").getUTCDay() + 6) % 7;
  const status = (day: string) => {
    if (day > today) return t("Будущий день", "Future day");
    if (
      day < habit.startedOn ||
      habit.inactiveRanges.some((r) => day >= r.from && (r.through === null || day < r.through)) ||
      !isDue(scheduleAt(habit.scheduleVersions, day), day)
    )
      return t("Не запланировано", "Not scheduled");
    const entry = entries.find((e) => e.localDate === day && !e.deleted);
    return entry?.status === "done"
      ? t("Выполнено", "Done")
      : entry?.status === "skip"
        ? t("Пропуск", "Skipped")
        : entry?.value
          ? `${entry.value} ${habit.unit}`
          : t("Нет отметки", "No check-in");
  };
  return (
    <section
      className="card p-4 mb-5 space-y-4"
      aria-label={t("История привычки", "Habit history")}
    >
      <div className="journal-between">
        <Link className="journal-button" href={`/habits/${habit.id}/edit`}>
          {t("Настроить привычку", "Edit habit")}
        </Link>
        {habit.archivedOn && <b>{t("В архиве", "Archived")}</b>}
      </div>
      <dl className="grid grid-cols-2 gap-4">
        <div>
          <dt className="label">{t("Текущая серия", "Current streak")}</dt>
          <dd className="text-xl font-bold">
            {streak.current} {unit(streak.current)}
          </dd>
        </div>
        <div>
          <dt className="label">{t("Лучшая серия", "Best streak")}</dt>
          <dd className="text-xl font-bold">
            {streak.best} {unit(streak.best)}
          </dd>
        </div>
      </dl>
      <div className="journal-between">
        <button
          className="journal-button"
          aria-label={t("Предыдущий месяц", "Previous month")}
          onClick={() => select(shiftDate(from, -1))}
        >
          ←
        </button>
        <h2>
          {new Intl.DateTimeFormat(locale, {
            month: "long",
            year: "numeric",
            timeZone: "UTC",
          }).format(new Date(from))}
        </h2>
        <button
          className="journal-button"
          aria-label={t("Следующий месяц", "Next month")}
          onClick={() => select(shiftDate(end, 1))}
        >
          →
        </button>
      </div>
      <p>
        {t("Цель за месяц", "Monthly progress")}:{" "}
        {totals.due
          ? `${totals.done} / ${totals.due} · ${Math.round((totals.done / totals.due) * 100)}%`
          : "—"}
      </p>
      <div className="journal-calendar grid grid-cols-7 gap-1">
        {(locale === "ru"
          ? ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"]
          : ["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"]
        ).map((d) => (
          <span className="text-center text-sm" key={d}>
            {d}
          </span>
        ))}
        {Array.from({ length: first }, (_, i) => (
          <span key={`blank${i}`} />
        ))}
        {Array.from({ length: Number(end.slice(8)) }, (_, i) => shiftDate(from, i)).map((day) => {
          const entry = entries.find((e) => e.localDate === day && !e.deleted);
          return (
            <button
              key={day}
              className="journal-date"
              aria-pressed={date === day}
              aria-label={`${day}: ${status(day)}`}
              onClick={() => select(day)}
            >
              <b>{Number(day.slice(8))}</b>
              <small>
                {entry?.status === "done"
                  ? "✓"
                  : entry?.status === "skip"
                    ? "−"
                    : entry?.value
                      ? "◔"
                      : "·"}
              </small>
            </button>
          );
        })}
      </div>
      <p className="text-sm text-ink-3">
        ✓ {t("Выполнено", "Done")} · − {t("Пропуск", "Skip")} · ◔ {t("Часть цели", "In progress")}
      </p>
      <details>
        <summary className="cursor-pointer">{t("История чисел", "Check-in values")}</summary>
        <ul className="max-h-52 overflow-auto">
          {entries
            .filter((e) => !e.deleted && e.localDate >= from && e.localDate <= end)
            .sort((a, b) => b.localDate.localeCompare(a.localDate))
            .map((e) => (
              <li key={e.id}>
                {e.localDate}: {status(e.localDate)}
                {e.status === "done" && habit.type !== "binary"
                  ? ` · ${e.value} ${habit.unit}`
                  : ""}
              </li>
            ))}
        </ul>
      </details>
    </section>
  );
}
