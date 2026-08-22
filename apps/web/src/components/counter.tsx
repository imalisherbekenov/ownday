"use client";
import { useTelegram } from "./telegram-provider";
export function Counter({ value, target, unit }: { value: number; target: number; unit: string }) {
  const tg = useTelegram();
  return (
    <div className="w-full" data-testid="counter-control">
      <div className="flex items-center justify-start gap-2">
        <button
          name="delta"
          value="-1"
          aria-label={`Decrease ${unit}`}
          className="h-8 w-8 rounded-check bg-surface-2 text-lg"
          onClick={() => tg?.HapticFeedback?.impactOccurred("light")}
        >
          −
        </button>
        <span className="number min-w-8 text-center text-lg">{value}</span>
        <button
          name="delta"
          value="1"
          aria-label={`Increase ${unit}`}
          className="h-8 w-8 rounded-check bg-surface-2 text-lg"
          onClick={() => tg?.HapticFeedback?.impactOccurred("light")}
        >
          +
        </button>
      </div>
      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-surface-2">
        <div
          className="h-full rounded-full bg-done"
          style={{ width: `${Math.min(100, (value / target) * 100)}%` }}
        />
      </div>
    </div>
  );
}
