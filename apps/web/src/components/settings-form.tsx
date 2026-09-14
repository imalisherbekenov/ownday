"use client";
import { useState } from "react";
import { useTelegram } from "./telegram-provider";
import { useInterfaceLocale } from "./interface-locale";
export function SettingsForm({
  timezone,
  dayStartHour,
  theme,
  telegram,
  email,
  action,
  signOutAction,
  deleteAction,
}: {
  timezone: string;
  dayStartHour: number;
  theme: string;
  telegram?: string | undefined;
  email?: string | undefined;
  action: (d: FormData) => Promise<void>;
  signOutAction: () => Promise<void>;
  deleteAction: (d: FormData) => Promise<void>;
}) {
  const { t, locale } = useInterfaceLocale();
  const insideTelegram = useTelegram().webApp !== null;
  const [saving, setSaving] = useState(false),
    [message, setMessage] = useState(""),
    [error, setError] = useState(false),
    [deleting, setDeleting] = useState(false),
    [confirmation, setConfirmation] = useState("");
  return (
    <div className="space-y-8">
      <form
        id="settings-form"
        className="space-y-6"
        onSubmit={async (e) => {
          e.preventDefault();
          if (saving) return;
          const data = new FormData(e.currentTarget);
          setSaving(true);
          setMessage("");
          setError(false);
          try {
            await action(data);
            setMessage(data.get("locale") === "en" ? "Settings saved." : "Настройки сохранены.");
          } catch {
            setError(true);
            setMessage(
              t(
                "Не удалось сохранить. Проверь часовой пояс и повтори.",
                "Could not save. Check the timezone and try again.",
              ),
            );
          } finally {
            setSaving(false);
          }
        }}
      >
        <fieldset disabled={saving} className="space-y-6">
          <section className="card p-5 space-y-4">
            <h2 className="text-xl font-bold">{t("Твой день", "Your day")}</h2>
            <label className="block space-y-2">
              <span>{t("Часовой пояс", "Timezone")}</span>
              <input
                className="control"
                name="timezone"
                required
                maxLength={100}
                defaultValue={timezone}
                placeholder="Asia/Tashkent"
              />
            </label>
            <label className="block space-y-2">
              <span>{t("Начало дня", "Day starts at")}</span>
              <select className="control" name="dayStartHour" defaultValue={dayStartHour}>
                {Array.from({ length: 24 }, (_, i) => (
                  <option key={i} value={i}>
                    {String(i).padStart(2, "0")}:00
                  </option>
                ))}
              </select>
            </label>
            <p className="text-sm text-ink-3">
              {t(
                "Ночные отметки до этого часа относятся к предыдущему дню. Сохранённые даты истории не меняются.",
                "Check-ins before this hour belong to the previous day. Existing history dates stay the same.",
              )}
            </p>
          </section>
          <section className="card p-5 space-y-4">
            <h2 className="text-xl font-bold">{t("Как тебе удобно", "Make yourself at home")}</h2>
            <label className="block space-y-2">
              <span>{t("Язык", "Language")}</span>
              <select className="control" name="locale" defaultValue={locale}>
                <option value="ru">Русский</option>
                <option value="en">English</option>
              </select>
            </label>
            <label className="block space-y-2">
              <span>{t("Тема", "Theme")}</span>
              <select className="control" name="theme" defaultValue={theme}>
                <option value="system">{t("Системная", "System")}</option>
                <option value="light">{t("Светлая", "Light")}</option>
                <option value="dark">{t("Тёмная", "Dark")}</option>
              </select>
            </label>
          </section>
          <button className="primary" type="submit" disabled={saving}>
            {saving ? t("Сохраняем…", "Saving…") : t("Сохранить настройки", "Save settings")}
          </button>
        </fieldset>
        {message && (
          <p className="journal-message" role={error ? "alert" : "status"}>
            {message}
          </p>
        )}
      </form>
      <section className="card p-5 space-y-4">
        <h2 className="text-xl font-bold">{t("Аккаунт и данные", "Account and data")}</h2>
        <p>Telegram: {telegram ?? t("Не привязан", "Not linked")}</p>
        <p className="break-words">Email: {email ?? t("Не указан", "Not set")}</p>
        <p>
          {t(
            "Привычки и все отметки одним файлом JSON.",
            "Habits and all check-ins in one JSON file.",
          )}
        </p>
        <a className="journal-button" href="/api/export">
          {t("Скачать мои данные", "Download my data")}
        </a>
        {!insideTelegram && (
          <form action={signOutAction}>
            <button className="journal-button">{t("Выйти из аккаунта", "Sign out")}</button>
          </form>
        )}
      </section>
      <section className="space-y-3">
        {!deleting ? (
          <button className="journal-button text-miss" onClick={() => setDeleting(true)}>
            {t("Удалить аккаунт", "Delete account")}
          </button>
        ) : (
          <form action={deleteAction} className="card p-5 space-y-4">
            <h2 className="font-bold">
              {t("Удалить аккаунт и всю историю?", "Delete your account and all history?")}
            </h2>
            <p>
              {t(
                "Данные на сервере будут удалены. Это действие нельзя отменить. Сначала можно скачать копию выше.",
                "Your server data will be deleted. This cannot be undone. You can download a copy above first.",
              )}
            </p>
            <label className="block space-y-2">
              <span>{t("Введи DELETE для удаления", "Type DELETE to confirm")}</span>
              <input
                className="control"
                name="confirmation"
                autoComplete="off"
                value={confirmation}
                onChange={(e) => setConfirmation(e.target.value)}
              />
            </label>
            <div className="journal-controls">
              <button
                type="button"
                className="journal-button"
                onClick={() => {
                  setDeleting(false);
                  setConfirmation("");
                }}
              >
                {t("Отмена", "Cancel")}
              </button>
              <button className="journal-button text-miss" disabled={confirmation !== "DELETE"}>
                {t("Удалить навсегда", "Delete permanently")}
              </button>
            </div>
          </form>
        )}
      </section>
    </div>
  );
}
