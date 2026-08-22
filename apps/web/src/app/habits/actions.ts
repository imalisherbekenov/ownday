"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { Schedule } from "@ownday/core";
import { getCurrentUserId, services } from "@/lib/services";
const colors = new Set(["moss", "ocean", "indigo", "plum", "clay", "amber", "olive", "slate"]);
const types = new Set(["binary", "counter", "duration"]);
function scheduleFromForm(data: FormData, anchor: string): Schedule {
  const kind = String(data.get("schedule"));
  if (kind === "daily") return { kind: "daily" };
  if (kind === "days_of_week") {
    const days = data
      .getAll("days")
      .map(Number)
      .filter((n) => n >= 1 && n <= 7);
    if (!days.length) throw new Error("Выберите хотя бы один день");
    return { kind, days };
  }
  if (kind === "times_per_week")
    return { kind, target: Math.max(1, Number(data.get("times") || 1)) };
  if (kind === "interval_days")
    return {
      kind,
      every: Math.max(1, Number(data.get("interval") || 1)),
      anchor,
    };
  throw new Error("Некорректное расписание");
}
function fields(data: FormData, anchor: string) {
  const title = String(data.get("title") ?? "").trim(),
    type = String(data.get("type")),
    color = String(data.get("color"));
  if (title.length < 2) throw new Error("Название слишком короткое");
  if (!types.has(type) || !colors.has(color)) throw new Error("Некорректные параметры привычки");
  const numeric = type !== "binary";
  return {
    title,
    type: type as "binary" | "counter" | "duration",
    icon: String(data.get("icon") || "check"),
    color,
    targetValue: numeric ? Math.max(1, Number(data.get("target") || 1)) : null,
    unit: numeric ? String(data.get("unit") || (type === "duration" ? "мин" : "раз")) : null,
    schedule: scheduleFromForm(data, anchor),
  };
}
export async function saveHabitAction(id: string | undefined, data: FormData) {
  const userId = await getCurrentUserId();
  const today = await services.localDateForUser(userId, new Date());
  const input = fields(data, today);
  let habitId = id;
  if (id) {
    const old = (await services.listHabits(userId, true)).find((h) => h.id === id);
    if (!old) throw new Error("HABIT_NOT_FOUND");
    const changed =
      JSON.stringify(old.scheduleVersions.at(-1)?.schedule) !== JSON.stringify(input.schedule);
    await services.updateHabit(id, userId, {
      ...input,
      ...(changed
        ? {
            schedule: input.schedule,
            validFrom: old.scheduleVersions.some((v) => v.validFrom === today)
              ? new Date(Date.parse(`${today}T00:00:00Z`) + 86400000).toISOString().slice(0, 10)
              : today,
          }
        : {}),
    });
  } else habitId = (await services.createHabit({ ...input, userId, validFrom: today })).id;
  if (data.get("reminder") === "on" && habitId) {
    await services.createReminder({
      userId,
      habitId,
      localTime: `${String(data.get("reminderTime") || "09:00")}:00`,
      daysMask: 127,
      now: new Date(),
    });
  }
  revalidatePath("/");
  revalidatePath("/habits");
  redirect("/habits");
}
export async function reorderHabitsAction(ids: string[]) {
  const userId = await getCurrentUserId();
  await services.reorderHabits(userId, ids);
  revalidatePath("/habits");
}
export async function archiveAction(id: string) {
  await services.archiveHabit(id, await getCurrentUserId());
  revalidatePath("/habits");
}
export async function restoreAction(id: string) {
  await services.restoreHabit(id, await getCurrentUserId());
  revalidatePath("/habits");
}
