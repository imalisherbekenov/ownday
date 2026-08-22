"use server";
import { revalidatePath } from "next/cache";
import { getCurrentUserId, services } from "@/lib/services";
import type { HabitTemplate } from "@ownday/services";
export async function addTemplateAction(template: HabitTemplate) {
  const userId = await getCurrentUserId(),
    today = await services.localDateForUser(userId, new Date());
  await services.createHabit({
    userId,
    title: template.title,
    type: template.defaultType,
    icon: template.icon,
    color: "moss",
    schedule: template.defaultSchedule,
    validFrom: today,
    ...(template.defaultType === "counter"
      ? { targetValue: 8, unit: "раз" }
      : template.defaultType === "duration"
        ? { targetValue: 20, unit: "мин" }
        : {}),
  });
  revalidatePath("/");
  revalidatePath("/habits");
}
