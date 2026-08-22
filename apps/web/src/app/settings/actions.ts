"use server";
import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getCurrentUserId, services } from "@/lib/services";
export async function saveSettingsAction(data: FormData) {
  const userId = await getCurrentUserId(),
    timezone = String(data.get("timezone") || "UTC"),
    dayStartHour = Math.min(12, Math.max(0, Number(data.get("dayStartHour") || 4))),
    theme = String(data.get("theme") || "system");
  await services.updateUser(userId, { timezone, dayStartHour });
  const jar = await cookies();
  if (theme === "system") jar.delete("ownday_theme");
  else jar.set("ownday_theme", theme, { sameSite: "lax", path: "/" });
  revalidatePath("/settings");
}
export async function exportDataAction() {
  const userId = await getCurrentUserId();
  await services.getUserSummary(userId, { days: 365 });
  revalidatePath("/settings");
}
export async function deleteAccountAction() {
  await services.deleteUser(await getCurrentUserId());
  (await cookies()).delete("ownday_session");
  redirect("/");
}
