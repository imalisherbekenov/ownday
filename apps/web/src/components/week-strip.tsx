export type WeekDay = {
  letter: string;
  date: number;
  fraction?: number;
  state?: "done" | "skip" | "miss" | "future";
  today?: boolean;
};
export function WeekStrip({ days, compact = false }: { days: WeekDay[]; compact?: boolean }) {
  return (
    <div className="grid grid-cols-7 gap-2" aria-label="This week">
      {days.map((day, i) => (
        <div key={i} className="flex flex-col items-center gap-1">
          <span className="label">{day.letter}</span>
          {!compact && (
            <span
              className={`number text-sm ${day.today ? "flex h-7 w-7 items-center justify-center rounded-full bg-ink text-surface" : ""}`}
            >
              {day.date}
            </span>
          )}
          <DayIndicator {...day} />
        </div>
      ))}
    </div>
  );
}
function DayIndicator(day: WeekDay) {
  if (day.state === "done")
    return <span aria-label="done" className="h-4 w-4 rounded-full bg-done" />;
  if (day.state === "skip")
    return (
      <span
        aria-label="skipped"
        className="h-4 w-4 rounded-full border-2 border-ink-3 bg-surface-2"
      >
        <span className="sr-only">Skipped</span>
      </span>
    );
  if (day.state === "miss")
    return (
      <span
        aria-label="missed"
        className="relative h-4 w-4 rounded-full border-2 border-miss after:absolute after:left-[2px] after:top-[5px] after:h-0.5 after:w-2 after:rotate-[-45deg] after:bg-miss"
      />
    );
  const fraction = Math.max(0, Math.min(1, day.fraction ?? 0));
  return (
    <svg
      aria-label={`${Math.round(fraction * 100)}% complete`}
      className="h-4 w-4 -rotate-90"
      viewBox="0 0 16 16"
    >
      <circle cx="8" cy="8" r="6" fill="none" stroke="var(--color-line)" strokeWidth="2" />
      {fraction > 0 && (
        <circle
          cx="8"
          cy="8"
          r="6"
          fill="none"
          stroke="var(--color-done)"
          strokeWidth="2"
          strokeLinecap="round"
          pathLength="1"
          strokeDasharray={`${fraction} 1`}
        />
      )}
    </svg>
  );
}
