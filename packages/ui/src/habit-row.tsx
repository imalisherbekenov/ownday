import type { ReactNode } from "react";
import { Checkbox } from "./checkbox";
import { Counter } from "./counter";
import { StreakPill } from "./streak-pill";

export type HabitRowType = "binary" | "counter" | "duration";
export type LinkRenderer = (props: {
  href: string;
  children: ReactNode;
  className?: string;
}) => ReactNode;
export type HabitRowProps = {
  id: string;
  title: string;
  type: HabitRowType;
  icon: string;
  color: string;
  value: number;
  target: number | null;
  unit: string | null;
  done: boolean;
  streak: number;
  action?: (formData: FormData) => void | Promise<void>;
  renderLink?: LinkRenderer;
  onInteraction?: () => void;
};

export function HabitRow(props: HabitRowProps) {
  const counter = props.type === "counter" && props.target !== null;
  const linkProps = {
    href: `/habit/${props.id}`,
    className: "block min-w-0",
    children: (
      <>
        <span
          className={`block break-words font-semibold ${props.done ? "text-ink-3 line-through decoration-line" : ""}`}
        >
          {props.title}
        </span>
        <span className="block text-sm text-ink-3">
          {props.type === "counter"
            ? `${props.value} of ${props.target ?? 0} ${props.unit ?? ""}`
            : "Daily"}
        </span>
      </>
    ),
  };
  const title = props.renderLink ? props.renderLink(linkProps) : <a {...linkProps} />;
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
        <Checkbox checked={props.done} label={props.title} onInteraction={props.onInteraction} />
      )}
      <div className="min-w-0 flex-1" data-testid="habit-content">
        <div data-testid="habit-title-container" className="min-w-0">
          {title}
        </div>
        {counter && (
          <div className="mt-2 w-full" data-testid="counter-row">
            <Counter
              value={props.value}
              target={props.target!}
              unit={props.unit ?? "units"}
              onInteraction={props.onInteraction}
            />
          </div>
        )}
      </div>
      <StreakPill streak={props.streak} />
    </form>
  );
}
