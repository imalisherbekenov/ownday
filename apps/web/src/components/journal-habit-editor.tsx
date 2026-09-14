"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  assertSyncOperation,
  localDateFor,
  sameSchedule,
  scheduleAt,
  validateHabitFields,
  validateSchedule,
} from "@ownday/core";
import type {
  HabitOperation,
  HabitSnapshot,
  Schedule,
  SyncResult,
  SyncSnapshot,
} from "@ownday/core";
import { applyJournalOperation } from "@/app/journal-actions";
import { useInterfaceLocale } from "./interface-locale";
import { JournalIcon } from "./journal-icon";
import type { HabitTemplate } from "@ownday/services";
export function JournalHabitEditor({
  snapshot,
  initial,
  template,
}: {
  snapshot: SyncSnapshot;
  initial?: HabitSnapshot;
  template?: HabitTemplate | undefined;
}) {
  const { t, locale } = useInterfaceLocale(),
    router = useRouter();
  const today = localDateFor(
    new Date(),
    snapshot.preferences.timezone,
    snapshot.preferences.dayStartHour,
  );
  const original = initial
    ? scheduleAt(initial.scheduleVersions, today)
    : (template?.defaultSchedule ?? ({ kind: "daily" } as Schedule));
  const [title, setTitle] = useState(initial?.title ?? template?.title ?? ""),
    [type, setType] = useState(initial?.type ?? template?.defaultType ?? "binary"),
    [target, setTarget] = useState(String(initial?.targetValue ?? 8)),
    [unit, setUnit] = useState(initial?.unit ?? ""),
    [time, setTime] = useState(initial?.time ?? "morning"),
    [icon, setIcon] = useState(initial?.icon ?? template?.icon ?? "leaf");
  const [kind, setKind] = useState<Schedule["kind"]>(original.kind),
    [days, setDays] = useState(original.kind === "days_of_week" ? original.days : [1, 2, 3, 4, 5]),
    [quota, setQuota] = useState(
      String(
        original.kind === "times_per_week" || original.kind === "times_per_month"
          ? original.target
          : 3,
      ),
    ),
    [every, setEvery] = useState(String(original.kind === "interval_days" ? original.every : 2));
  const [pending, setPending] = useState<HabitOperation | null>(null),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [conflict, setConflict] = useState<SyncResult | null>(null);
  const key = `ownday.web.habit.pending:${snapshot.userId}:${initial?.id ?? "new"}`;
  useEffect(() => {
    try {
      const raw = sessionStorage.getItem(key);
      if (raw) {
        const stored = JSON.parse(raw);
        assertSyncOperation({ kind: "habit", change: stored });
        setPending(stored);
        setTitle(stored.habit.title);
        setType(stored.habit.type);
        setTarget(String(stored.habit.targetValue ?? 1));
        setUnit(stored.habit.unit);
        setTime(stored.habit.time);
        setIcon(stored.habit.icon);
        setError(
          t(
            "Есть неподтверждённое сохранение. Повтори отправку.",
            "There is an unconfirmed save. Retry it.",
          ),
        );
      }
    } catch {
      setError(t("Не удалось прочитать сохранённое действие.", "Could not read the saved action."));
    }
  }, [key, t]);
  function schedule(): Schedule {
    if (kind === "daily") return { kind };
    if (kind === "days_of_week") return { kind, days: [...days].sort() };
    if (kind === "interval_days")
      return {
        kind,
        every: Number(every),
        anchor: original.kind === "interval_days" ? original.anchor : today,
      };
    return { kind, target: Number(quota) };
  }
  async function send(change: HabitOperation) {
    if (busy) return;
    setBusy(true);
    setError("");
    setPending(change);
    try {
      sessionStorage.setItem(key, JSON.stringify(change));
      const result = await applyJournalOperation(snapshot.userId, { kind: "habit", change });
      if (result.outcome === "conflict") {
        setConflict(result);
      } else {
        sessionStorage.removeItem(key);
        setPending(null);
        router.push(`/habit/${change.habit.id}`);
        router.refresh();
      }
    } catch {
      setError(
        t(
          "Сохранение не подтверждено. Повтор не создаст дубликат.",
          "The save is unconfirmed. Retrying will not create a duplicate.",
        ),
      );
    } finally {
      setBusy(false);
    }
  }
  function submit(event: React.FormEvent) {
    event.preventDefault();
    if (pending) {
      void send(pending);
      return;
    }
    try {
      const nextSchedule = schedule();
      validateSchedule(nextSchedule);
      const habit: HabitSnapshot = {
        ...(initial ?? {
          id: crypto.randomUUID(),
          createdAt: new Date().toISOString(),
          startedOn: today,
          archivedOn: null,
          inactiveRanges: [],
          sortOrder: snapshot.habits.length,
          scheduleVersions: [],
        }),
        title: title.trim(),
        type,
        targetValue: type === "binary" ? null : Number(target.replace(",", ".")),
        unit: type === "binary" ? "" : unit.trim(),
        time,
        icon,
        revision: (initial?.revision ?? 0) + 1,
      };
      validateHabitFields(habit);
      habit.scheduleVersions =
        initial && sameSchedule(original, nextSchedule)
          ? initial.scheduleVersions
          : [
              ...(initial?.scheduleVersions.filter((v) => v.validFrom !== today) ?? []),
              { validFrom: today, schedule: nextSchedule },
            ].sort((a, b) => a.validFrom.localeCompare(b.validFrom));
      void send({ operationId: crypto.randomUUID(), baseRevision: initial?.revision ?? 0, habit });
    } catch {
      setError(
        t(
          "Проверь название, положительную цель и расписание. У числа может быть до трёх знаков после запятой.",
          "Check the name, positive goal and schedule. Numbers support up to three decimal places.",
        ),
      );
    }
  }
  function useOwn() {
    if (!pending || conflict?.kind !== "habit" || !conflict.habit) return;
    const remote = conflict.habit;
    const habit = {
      ...pending.habit,
      revision: remote.revision + 1,
      startedOn: remote.startedOn,
      createdAt: remote.createdAt,
    };
    if (conflict.reason === "HISTORICAL_SCHEDULE_IMMUTABLE")
      habit.scheduleVersions = [
        ...remote.scheduleVersions.filter((v) => v.validFrom !== today),
        { validFrom: today, schedule: scheduleAt(pending.habit.scheduleVersions, today) },
      ].sort((a, b) => a.validFrom.localeCompare(b.validFrom));
    setConflict(null);
    void send({ operationId: crypto.randomUUID(), baseRevision: remote.revision, habit });
  }
  return (
    <main className="page journal-page">
      <header className="journal-heading">
        <p className="label">{t("Твой ритм", "Your rhythm")}</p>
        <h1>
          {initial
            ? t("О привычке", "About your habit")
            : t("Один маленький шаг", "One little step")}
        </h1>
        <p>
          {t(
            "Выбери действие, к которому хочется вернуться завтра.",
            "Choose something you would like to come back to tomorrow.",
          )}
        </p>
      </header>
      <Link className="journal-button mb-5" href={initial ? `/habit/${initial.id}` : "/templates"}>
        {initial
          ? t("Назад к привычке", "Back to habit")
          : t("Выбрать шаблон", "Choose a template")}
      </Link>
      <form onSubmit={submit} className="space-y-5">
        <fieldset disabled={busy || pending !== null} className="space-y-5">
          <label className="block space-y-2">
            <span className="label">
              {t("Что ты хочешь делать?", "What would you like to do?")}
            </span>
            <input
              className="control"
              name="title"
              required
              maxLength={160}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          </label>
          <fieldset>
            <legend className="label mb-2">{t("Как отмечать", "How to check in")}</legend>
            <div className="journal-controls">
              {(["binary", "counter", "duration"] as const).map((value) => (
                <button
                  type="button"
                  key={value}
                  disabled={Boolean(initial)}
                  aria-pressed={type === value}
                  className="journal-button aria-pressed:bg-done-soft"
                  onClick={() => setType(value)}
                >
                  {value === "binary"
                    ? t("Да / нет", "Yes / no")
                    : value === "counter"
                      ? t("Количество", "Amount")
                      : t("Минуты", "Minutes")}
                </button>
              ))}
            </div>
          </fieldset>
          {type !== "binary" && (
            <div className="grid grid-cols-2 gap-3">
              <label className="block space-y-2">
                <span className="label">{t("Цель", "Goal")}</span>
                <input
                  className="control"
                  required
                  inputMode="decimal"
                  value={target}
                  onChange={(e) => setTarget(e.target.value)}
                />
              </label>
              <label className="block space-y-2">
                <span className="label">{t("Единица", "Unit")}</span>
                <input
                  className="control"
                  maxLength={32}
                  value={unit}
                  placeholder={type === "duration" ? t("мин", "min") : t("раз", "times")}
                  onChange={(e) => setUnit(e.target.value)}
                />
              </label>
            </div>
          )}
          <label className="block space-y-2">
            <span className="label">{t("Расписание", "Schedule")}</span>
            <select
              className="control"
              value={kind}
              onChange={(e) => setKind(e.target.value as Schedule["kind"])}
            >
              <option value="daily">{t("Каждый день", "Every day")}</option>
              <option value="days_of_week">{t("По дням недели", "Selected weekdays")}</option>
              <option value="times_per_week">{t("Несколько раз в неделю", "Weekly goal")}</option>
              <option value="times_per_month">{t("Несколько раз в месяц", "Monthly goal")}</option>
              <option value="interval_days">{t("Через несколько дней", "Every few days")}</option>
            </select>
          </label>
          {kind === "days_of_week" && (
            <fieldset>
              <legend className="label mb-2">{t("Дни недели", "Weekdays")}</legend>
              <div className="grid grid-cols-7 gap-1">
                {(locale === "ru"
                  ? ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"]
                  : ["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"]
                ).map((label, index) => (
                  <label
                    key={index}
                    className="flex min-h-14 flex-col items-center justify-center gap-1 rounded-input bg-surface-2"
                  >
                    <input
                      type="checkbox"
                      checked={days.includes(index + 1)}
                      onChange={() =>
                        setDays((old) =>
                          old.includes(index + 1)
                            ? old.filter((d) => d !== index + 1)
                            : [...old, index + 1],
                        )
                      }
                    />
                    {label}
                  </label>
                ))}
              </div>
            </fieldset>
          )}
          {(kind === "times_per_week" || kind === "times_per_month") && (
            <label className="block space-y-2">
              <span className="label">{t("Выполнений за период", "Check-ins per period")}</span>
              <input
                className="control"
                type="number"
                min={1}
                max={kind === "times_per_week" ? 7 : 31}
                required
                value={quota}
                onChange={(e) => setQuota(e.target.value)}
              />
            </label>
          )}
          {kind === "interval_days" && (
            <label className="block space-y-2">
              <span className="label">{t("Каждые … дней", "Every … days")}</span>
              <input
                className="control"
                type="number"
                min={1}
                max={365}
                required
                value={every}
                onChange={(e) => setEvery(e.target.value)}
              />
            </label>
          )}
          <label className="block space-y-2">
            <span className="label">{t("Время для себя", "Time for yourself")}</span>
            <select
              className="control"
              value={time}
              onChange={(e) => setTime(e.target.value as HabitSnapshot["time"])}
            >
              <option value="morning">{t("Утро", "Morning")}</option>
              <option value="afternoon">{t("День", "Afternoon")}</option>
              <option value="evening">{t("Вечер", "Evening")}</option>
            </select>
          </label>
          <details className="card p-4">
            <summary className="cursor-pointer font-bold">
              {t("Немного индивидуальности", "Make it yours")}
            </summary>
            <div className="journal-controls mt-4">
              {["leaf", "water", "book", "sun", "timer", "check"].map((name) => (
                <button
                  type="button"
                  key={name}
                  aria-label={t("Иконка ", "Icon ") + name}
                  aria-pressed={icon === name}
                  className="journal-button aria-pressed:bg-done-soft"
                  onClick={() => setIcon(name)}
                >
                  <JournalIcon name={name} />
                </button>
              ))}
            </div>
          </details>
        </fieldset>
        {error && (
          <p className="journal-message" role="alert">
            {error}
          </p>
        )}
        {conflict?.kind === "habit" && (
          <section className="journal-message">
            <h2>
              {t(
                "Привычка изменилась на другом устройстве",
                "This habit changed on another device",
              )}
            </h2>
            <p>
              {t("Твой вариант", "Your version")}: {pending?.habit.title} ·{" "}
              {pending?.habit.targetValue ?? 1}
            </p>
            <p>
              {t("Серверный вариант", "Server version")}:{" "}
              {conflict.habit?.title ?? t("Удалена", "Deleted")} ·{" "}
              {conflict.habit?.targetValue ?? "—"}
            </p>
            <div className="journal-controls">
              <button
                type="button"
                className="journal-button"
                disabled={busy}
                onClick={() => {
                  sessionStorage.removeItem(key);
                  router.push("/habits");
                  router.refresh();
                }}
              >
                {t("Оставить серверный", "Keep server version")}
              </button>
              {conflict.habit && (
                <button type="button" className="journal-button" disabled={busy} onClick={useOwn}>
                  {t("Применить мой вариант с сегодня", "Apply mine from today")}
                </button>
              )}
            </div>
          </section>
        )}
        <p className="text-sm text-ink-3">
          {t(
            "Изменение расписания действует с сегодняшнего дня. Прошлые дни сохраняются.",
            "Schedule changes start today. Past days are preserved.",
          )}
        </p>
        {!conflict && (
          <button className="primary" type="submit" disabled={busy}>
            {busy
              ? t("Сохраняем…", "Saving…")
              : pending
                ? t("Повторить сохранение", "Retry save")
                : initial
                  ? t("Сохранить изменения", "Save changes")
                  : t("Добавить в мой день", "Add to my day")}
          </button>
        )}
      </form>
      {initial && !pending && (
        <button
          className="journal-button mt-6"
          disabled={busy}
          onClick={() => {
            const ranges = initial.archivedOn
              ? initial.inactiveRanges.map((r) =>
                  r.through === null ? { ...r, through: today } : r,
                )
              : [...initial.inactiveRanges, { from: today, through: null }];
            void send({
              operationId: crypto.randomUUID(),
              baseRevision: initial.revision,
              habit: {
                ...initial,
                revision: initial.revision + 1,
                archivedOn: initial.archivedOn ? null : today,
                inactiveRanges: ranges,
              },
            });
          }}
        >
          {initial.archivedOn
            ? t("Вернуть из архива", "Restore from archive")
            : t("Убрать в архив", "Archive habit")}
        </button>
      )}
    </main>
  );
}
