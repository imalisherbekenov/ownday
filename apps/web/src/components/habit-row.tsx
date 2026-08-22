import Link from "next/link";
import type { HabitType } from "@habits/services";
import { Checkbox } from "./checkbox";
import { Counter } from "./counter";
import { StreakPill } from "./streak-pill";

export type HabitRowProps = {
  id: string;
  title: string;
  type: HabitType;
  icon: string;
  color: string;
  value: number;
  target: number | null;
  unit: string | null;
  done: boolean;
  streak: number;
  action?: (formData: FormData) => void | Promise<void>;
};

function HabitTitle({ habit }: { habit: HabitRowProps }) {
  return (
    <Link href={`/habit/${habit.id}`} data-testid="habit-title-container" className="block min-w-0">
      <span
        className={`block break-words font-semibold ${
          habit.done ? "text-ink-3 line-through decoration-line" : ""
        }`}
      >
        {habit.title}
      </span>
      <span className="block text-sm text-ink-3">
        {habit.type === "counter"
          ? `${habit.value} of ${habit.target ?? 0} ${habit.unit ?? ""}`
          : "Daily"}
      </span>
    </Link>
  );
}

export function HabitRow(props: HabitRowProps) {
  const counter = props.type === "counter" && props.target !== null;

  return (
    <form
      action={props.action}
      data-habit-type={props.type}
      className="flex min-h-11 items-center gap-3 px-4 py-3"
    >
      <input type="hidden" name="habitId" value={props.id} />

      {counter ? (
        <div
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-input bg-surface-2 text-ink-2"
          style={{ color: `var(--color-hue-${props.color})` }}
          aria-hidden="true"
        >
          {props.icon.slice(0, 1).toUpperCase()}
        </div>
      ) : (
        <Checkbox checked={props.done} label={props.title} />
      )}

      <div className="min-w-0 flex-1" data-testid="habit-content">
        <HabitTitle habit={props} />
        {counter ? (
          <div className="mt-2 w-full" data-testid="counter-row">
            <Counter value={props.value} target={props.target!} unit={props.unit ?? "units"} />
          </div>
        ) : null}
      </div>

      <StreakPill streak={props.streak} />
    </form>
  );
}
