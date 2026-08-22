import { SettingsForm } from "@/components/settings-form";
import { getCurrentUserId, services } from "@/lib/services";
import { deleteAccountAction, exportDataAction, saveSettingsAction } from "./actions";
export const dynamic = "force-dynamic";
export default async function SettingsPage() {
  const userId = await getCurrentUserId(),
    user = await services.getUser(userId);
  if (!user) throw new Error("USER_NOT_FOUND");
  const [telegram, email] = await Promise.all([
    services.getUserIdentity(userId, "telegram"),
    services.getUserIdentity(userId, "email"),
  ]);
  return (
    <main className="page py-6">
      <header className="mb-6">
        <p className="label">Профиль</p>
        <h1 className="text-[32px] font-extrabold tracking-[-.03em]">Настройки</h1>
      </header>
      <SettingsForm
        timezone={user.timezone}
        dayStartHour={user.dayStartHour}
        telegram={telegram?.externalId}
        email={email?.externalId}
        action={saveSettingsAction}
        exportAction={exportDataAction}
        deleteAction={deleteAccountAction}
      />
    </main>
  );
}
