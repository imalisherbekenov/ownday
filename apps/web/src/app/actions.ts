"use server";
import { revalidatePath } from "next/cache";
import { getCurrentUserId, services } from "@/lib/services";
export async function markHabitAction(userId: string, localDate: string, formData: FormData) {
  if (userId !== (await getCurrentUserId())) throw new Error("UNAUTHORIZED");
  const habitId = String(formData.get("habitId"));
  const intent = String(formData.get("intent") ?? "");
  const delta = Number(formData.get("delta") ?? 0);
  if (intent === "undo") await services.undoEntry({ userId, habitId, localDate });
  else if (delta) {
    await services.applyEntryOperation({
      userId,
      habitId,
      localDate,
      operationId: crypto.randomUUID(),
      action: { kind: "increment", delta },
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
  revalidatePath("/today");
  revalidatePath(`/habit/${habitId}`);
}
