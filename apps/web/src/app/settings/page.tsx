import { SettingsForm } from "@/components/settings-form";
import { getCurrentUserId, services } from "@/lib/services";
import { deleteAccountAction, saveSettingsAction, signOutAction } from "./actions";
import { PrimaryActionAdapter } from "@/components/primary-action-adapter";
import { interfaceLocale } from "@/lib/interface-locale";
import { cookies } from "next/headers";
export const dynamic = "force-dynamic";
export default async function SettingsPage() {
  const locale = await interfaceLocale(),
    t = (ru: string, en: string) => (locale === "ru" ? ru : en);
  const theme = (await cookies()).get("ownday_theme")?.value ?? "system";
  const userId = await getCurrentUserId(),
    user = await services.getUser(userId);
  if (!user) throw new Error("USER_NOT_FOUND");
  const [telegram, email] = await Promise.all([
    services.getUserIdentity(userId, "telegram"),
    services.getUserIdentity(userId, "email"),
  ]);
  return (
    <main className="page py-6">
      <header className="app-header journal-heading mb-6">
        <p className="label">{t("Профиль", "Your space")}</p>
        <h1>{t("Настройки", "Make it yours.")}</h1>
      </header>
      <div>
        <SettingsForm
          timezone={user.timezone}
          dayStartHour={user.dayStartHour}
          theme={theme}
          telegram={telegram?.externalId}
          email={email?.externalId}
          action={saveSettingsAction}
          signOutAction={signOutAction}
          deleteAction={deleteAccountAction}
        />
      </div>
      <PrimaryActionAdapter formId="settings-form">
        {t("Сохранить настройки", "Save settings")}
      </PrimaryActionAdapter>
    </main>
  );
}
