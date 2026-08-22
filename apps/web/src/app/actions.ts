"use server";
import { revalidatePath } from "next/cache";
import { services } from "@/lib/services";
export async function markHabitAction(userId: string, localDate: string, formData: FormData) {
  const habitId = String(formData.get("habitId"));
  const intent = String(formData.get("intent") ?? "");
  const delta = Number(formData.get("delta") ?? 0);
  if (intent === "undo") await services.undoEntry({ userId, habitId, localDate });
  else if (delta) {
    const habit = (await services.listHabits(userId)).find((h) => h.id === habitId);
    if (!habit) throw new Error("HABIT_NOT_FOUND");
    const entries = await services.listHabitsForToday(userId, new Date(`${localDate}T12:00:00Z`));
    const current = entries.find((x) => x.habit.id === habitId)?.entry?.value ?? 0;
    await services.setEntryValue({
      userId,
      habitId,
      localDate,
      value: Math.max(0, current + delta),
      source: "web",
    });
  } else
    await services.markEntry({
      userId,
      habitId,
      localDate,
      status: "done",
      source: "web",
      clientId: crypto.randomUUID(),
    });
  revalidatePath("/");
  revalidatePath(`/habit/${habitId}`);
}
