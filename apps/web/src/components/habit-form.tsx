"use client";
import { useState } from "react";
import * as Tabs from "@radix-ui/react-tabs";
import * as Radio from "@radix-ui/react-radio-group";
import * as Switch from "@radix-ui/react-switch";
import type { Habit } from "@ownday/services";
const colors = ["moss", "ocean", "indigo", "plum", "clay", "amber", "olive", "slate"],
  days = ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"];
export function HabitForm({
  initial,
  action,
}: {
  initial?: Habit;
  action: (data: FormData) => void | Promise<void>;
}) {
  const [type, setType] = useState<string>(initial?.type ?? "binary"),
    [schedule, setSchedule] = useState<string>(
      initial?.scheduleVersions.at(-1)?.schedule.kind ?? "daily",
    ),
    [reminder, setReminder] = useState(false);
  return (
    <form action={action} className="space-y-6">
      <Field label="Название">
        <input
          className="control"
          name="title"
          required
          minLength={2}
          defaultValue={initial?.title}
        />
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Иконка">
          <select className="control" name="icon" defaultValue={initial?.icon ?? "check"}>
            {["check", "sun", "book", "timer", "activity", "moon", "droplet", "palette"].map(
              (x) => (
                <option key={x}>{x}</option>
              ),
            )}
          </select>
        </Field>
        <Field label="Цвет">
          <Radio.Root
            name="color"
            defaultValue={initial?.color ?? "moss"}
            className="grid grid-cols-8 gap-2"
          >
            {colors.map((c) => (
              <Radio.Item
                key={c}
                value={c}
                aria-label={c}
                className="h-11 rounded-check border-2 border-transparent data-[state=checked]:border-ink"
                style={{ backgroundColor: `var(--color-hue-${c})` }}
              />
            ))}
          </Radio.Root>
        </Field>
      </div>
      <Field label="Тип привычки">
        <Tabs.Root value={type} onValueChange={setType}>
          <Tabs.List className="segments">
            {(
              [
                ["binary", "Да / нет"],
                ["counter", "Счётчик"],
                ["duration", "Время"],
              ] as const
            ).map(([v, l]) => (
              <Tabs.Trigger
                name="type"
                key={v}
                value={v}
                className="segment"
                data-testid={`type-${v}`}
              >
                {l}
              </Tabs.Trigger>
            ))}
          </Tabs.List>
          <input type="hidden" name="type" value={type} />
        </Tabs.Root>
      </Field>
      {type !== "binary" && (
        <div data-testid="target-fields" className="grid grid-cols-2 gap-4">
          <Field label="Цель">
            <input
              className="control number"
              name="target"
              type="number"
              min="1"
              defaultValue={initial?.targetValue ?? (type === "duration" ? 20 : 8)}
            />
          </Field>
          <Field label="Единица">
            <input
              className="control"
              name="unit"
              defaultValue={initial?.unit ?? (type === "duration" ? "мин" : "раз")}
            />
          </Field>
        </div>
      )}
      <Field label="Расписание">
        <Radio.Root
          name="schedule"
          value={schedule}
          onValueChange={setSchedule}
          className="grid grid-cols-2 gap-2"
        >
          {(
            [
              ["daily", "Каждый день"],
              ["days_of_week", "По дням"],
              ["times_per_week", "Раз в неделю"],
              ["interval_days", "Интервал"],
            ] as const
          ).map(([v, l]) => (
            <Radio.Item
              data-testid={`schedule-${v}`}
              key={v}
              value={v}
              className="min-h-11 rounded-input bg-surface-2 px-3 text-left data-[state=checked]:bg-done-soft data-[state=checked]:text-done-ink"
            >
              {l}
            </Radio.Item>
          ))}
        </Radio.Root>
        {schedule === "days_of_week" && (
          <div data-testid="days-settings" className="mt-3 grid grid-cols-7 gap-1">
            {days.map((d, i) => (
              <label
                key={d}
                className="flex min-h-11 items-center justify-center rounded-check bg-surface-2"
              >
                <input className="sr-only" type="checkbox" name="days" value={i + 1} />
                {d}
              </label>
            ))}
          </div>
        )}
        {schedule === "times_per_week" && (
          <input
            data-testid="times-settings"
            className="control mt-3"
            name="times"
            type="number"
            min="1"
            max="7"
            defaultValue="3"
          />
        )}
        {schedule === "interval_days" && (
          <input
            data-testid="interval-settings"
            className="control mt-3"
            name="interval"
            type="number"
            min="2"
            defaultValue="2"
          />
        )}
      </Field>
      <div className="card flex items-center justify-between p-4">
        <div>
          <b>Напоминание</b>
          <p className="text-sm text-ink-3">В выбранное время</p>
        </div>
        <Switch.Root checked={reminder} onCheckedChange={setReminder} className="switch">
          <Switch.Thumb className="switch-thumb" />
        </Switch.Root>
      </div>
      {reminder && (
        <Field label="Время">
          <input className="control" type="time" name="reminderTime" defaultValue="09:00" />
        </Field>
      )}
      <button className="primary" type="submit">
        {initial ? "Сохранить изменения" : "Создать привычку"}
      </button>
    </form>
  );
}
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block space-y-2">
      <span className="label block">{label}</span>
      {children}
    </label>
  );
}
