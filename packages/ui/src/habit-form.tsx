"use client";

import { useState, type ReactNode } from "react";
import { useFormStatus } from "react-dom";
import * as Tabs from "@radix-ui/react-tabs";
import * as Radio from "@radix-ui/react-radio-group";
import * as Switch from "@radix-ui/react-switch";
import type { ScheduleVersion } from "@ownday/core";

export type HabitFormHabit = {
  title: string;
  type: "binary" | "counter" | "duration";
  icon: string;
  color: string;
  targetValue: number | null;
  unit: string | null;
  scheduleVersions: ScheduleVersion[];
};

const colors = ["moss", "ocean", "indigo", "plum", "clay", "amber", "olive", "slate"];
const days = ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"];

export function HabitForm({
  initial,
  action,
}: {
  initial?: HabitFormHabit;
  action: (data: FormData) => void | Promise<void>;
}) {
  const [type, setType] = useState(initial?.type ?? "binary");
  const [schedule, setSchedule] = useState(
    initial?.scheduleVersions.at(-1)?.schedule.kind ?? "daily",
  );
  const [reminder, setReminder] = useState(false);
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
              (icon) => (
                <option key={icon}>{icon}</option>
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
            {colors.map((color) => (
              <Radio.Item
                key={color}
                value={color}
                aria-label={color}
                className="h-11 rounded-check border-2 border-transparent data-[state=checked]:border-ink"
                style={{ backgroundColor: `var(--color-hue-${color})` }}
              />
            ))}
          </Radio.Root>
        </Field>
      </div>
      <Field label="Тип привычки">
        <Tabs.Root value={type} onValueChange={(value) => setType(value as typeof type)}>
          <Tabs.List className="segments">
            {[
              ["binary", "Да / нет"],
              ["counter", "Счётчик"],
              ["duration", "Время"],
            ].map(([value, label]) => (
              <Tabs.Trigger
                key={value}
                value={value!}
                className="segment"
                data-testid={`type-${value}`}
              >
                {label}
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
          onValueChange={(value) => setSchedule(value as typeof schedule)}
          className="grid grid-cols-2 gap-2"
        >
          {[
            ["daily", "Каждый день"],
            ["days_of_week", "По дням"],
            ["times_per_week", "Раз в неделю"],
            ["interval_days", "Интервал"],
          ].map(([value, label]) => (
            <Radio.Item
              data-testid={`schedule-${value}`}
              key={value}
              value={value!}
              className="min-h-11 rounded-input bg-surface-2 px-3 text-left data-[state=checked]:bg-done-soft data-[state=checked]:text-done-ink"
            >
              {label}
            </Radio.Item>
          ))}
        </Radio.Root>
        {schedule === "days_of_week" && (
          <div data-testid="days-settings" className="mt-3 grid grid-cols-7 gap-1">
            {days.map((day, index) => (
              <label
                key={day}
                className="flex min-h-11 items-center justify-center rounded-check bg-surface-2"
              >
                <input className="sr-only" type="checkbox" name="days" value={index + 1} />
                {day}
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
      <SubmitButton label={initial ? "Сохранить изменения" : "Создать привычку"} />
    </form>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block space-y-2">
      <span className="label block">{label}</span>
      {children}
    </label>
  );
}

// Пока ответ идёт, кнопка обязана быть недоступна. Без этого каждое нажатие
// доходит до сервера отдельной записью: на медленной связи семь нажатий дают
// семь одинаковых привычек, и человек считает, что кнопка не работает.
// useFormStatus читает состояние ближайшей формы, поэтому живёт внутри неё.
function SubmitButton({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <button className="primary" type="submit" disabled={pending} aria-busy={pending}>
      {pending ? "Сохраняем…" : label}
    </button>
  );
}
