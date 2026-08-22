"use client";

export function Counter({
  value,
  target,
  unit,
  onInteraction,
}: {
  value: number;
  target: number;
  unit: string;
  onInteraction?: (() => void) | undefined;
}) {
  const progress = target > 0 ? Math.min(100, (value / target) * 100) : 0;
  return (
    <div className="w-full" data-testid="counter-control">
      <div className="flex items-center justify-start gap-2">
        <button
          name="delta"
          value="-1"
          aria-label={`Decrease ${unit}`}
          className="h-11 w-11 rounded-check bg-surface-2 text-lg"
          onClick={onInteraction}
        >
          −
        </button>
        <span className="number min-w-8 text-center text-lg">{value}</span>
        <button
          name="delta"
          value="1"
          aria-label={`Increase ${unit}`}
          className="h-11 w-11 rounded-check bg-surface-2 text-lg"
          onClick={onInteraction}
        >
          +
        </button>
      </div>
      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-surface-2">
        <div className="h-full rounded-full bg-done" style={{ width: `${progress}%` }} />
      </div>
    </div>
  );
}
