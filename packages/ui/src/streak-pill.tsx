import { FlameIcon } from "./icons";

export type StreakMode = "none" | "neutral" | "hot" | "record";
export function streakMode(streak: number, isPersonalRecord = false): StreakMode {
  return streak === 0 ? "none" : isPersonalRecord ? "record" : streak >= 7 ? "hot" : "neutral";
}
export function StreakPill({
  streak,
  isPersonalRecord = false,
}: {
  streak: number;
  isPersonalRecord?: boolean;
}) {
  const mode = streakMode(streak, isPersonalRecord);
  if (mode === "none") return null;
  const hot = mode === "hot" || mode === "record";
  return (
    <span
      data-mode={mode}
      className={`number inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-1 text-sm ${hot ? "bg-streak-soft text-streak-ink" : "bg-surface-2 text-ink-3"}`}
    >
      <FlameIcon />
      {streak}
    </span>
  );
}
