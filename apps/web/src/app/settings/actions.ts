"use server";
import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getCurrentUserId, services } from "@/lib/services";
import { clearSession, sessionCookieOptions } from "@/lib/session";
export async function saveSettingsAction(data: FormData) {
  const userId = await getCurrentUserId(),
    timezone = String(data.get("timezone") || "UTC"),
    dayStartHour = Math.min(12, Math.max(0, Number(data.get("dayStartHour") || 4))),
    theme = String(data.get("theme") || "system");
  await services.updateUser(userId, { timezone, dayStartHour });
  const jar = await cookies();
  // Clearing the theme is a cookie write like any other and needs the same
  // attributes, or inside Telegram the preference silently stays behind.
  if (theme === "system") jar.set("ownday_theme", "", { ...sessionCookieOptions(), maxAge: 0 });
  else jar.set("ownday_theme", theme, sessionCookieOptions());
  revalidatePath("/settings");
}
export async function exportDataAction() {
  const userId = await getCurrentUserId();
  await services.getUserSummary(userId, { days: 365 });
  revalidatePath("/settings");
}
export async function deleteAccountAction() {
  await services.deleteUser(await getCurrentUserId());
  await clearSession();
  redirect("/");
}
