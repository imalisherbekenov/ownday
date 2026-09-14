import { useEffect, useMemo, useState } from "react";
import { Platform, Text, TextInput, View } from "react-native";
import { scheduleAt } from "@ownday/core";
import { Action } from "./journal-ui";
import type { JournalTheme } from "./journal-ui";
import type { LocalStore, LocalSnapshot, LocalHabit, LocalEntry } from "./local-store";
import {
  beginMobileLogin,
  beginAppleLogin,
  credentials,
  signOut,
  deleteMobileAccount,
} from "./mobile-auth";
import { AppleSignInButton } from "./AppleSignInButton";
import type { Credentials } from "./mobile-auth";
import { accountTransport } from "./account-transport";
import { syncForStore } from "./sync-engine";

export function AccountPanel({
  store,
  snapshot,
  theme,
  t,
  onChange,
  onProfileChange,
}: {
  store: LocalStore;
  snapshot: LocalSnapshot;
  theme: JournalTheme;
  t: (ru: string, en: string) => string;
  onChange: () => void;
  onProfileChange: () => void;
}) {
  const [session, setSession] = useState<Credentials | null>(null),
    [busy, setBusy] = useState(false),
    [message, setMessage] = useState("");
  const [deleting, setDeleting] = useState(false),
    [confirmation, setConfirmation] = useState("");
  const engine = useMemo(() => syncForStore(store), [store]);
  const account = snapshot.profileId.startsWith("account:"),
    { s } = theme;
  useEffect(() => {
    void credentials()
      .then(setSession)
      .catch(() => setMessage(t("Не удалось прочитать сессию", "Could not read your session")));
  }, []);
  async function synchronize(current = session) {
    if (!current || busy) return;
    setBusy(true);
    setMessage("");
    try {
      await engine.run(current.userId, accountTransport(current));
      onChange();
      setMessage(t("Данные обновлены", "Up to date"));
    } catch (error) {
      setMessage(
        error instanceof Error && error.message === "SESSION_EXPIRED"
          ? t("Войди снова. Локальная история сохранена.", "Sign in again. Local history is safe.")
          : t(
              "Не удалось связаться с сервером. Изменения сохранены; можно повторить позже.",
              "Could not reach the server. Changes are saved; you can retry later.",
            ),
      );
    } finally {
      setBusy(false);
      onChange();
    }
  }
  async function connect(apple = false) {
    if (busy) return;
    setBusy(true);
    setMessage("");
    try {
      const current = await (apple ? beginAppleLogin() : beginMobileLogin());
      if (!current) return;
      const remote = await accountTransport(current).snapshot();
      store.attachAccount(remote, store.profileId.startsWith("guest"));
      setSession(current);
      onProfileChange();
      await engine.run(current.userId, accountTransport(current));
      onChange();
    } catch {
      setMessage(
        t(
          "Вход или синхронизация не завершены. Данные на устройстве сохранены.",
          "Sign-in or sync did not finish. Your local data is safe.",
        ),
      );
    } finally {
      setBusy(false);
      onChange();
    }
  }
  async function leave() {
    setBusy(true);
    try {
      await signOut();
      store.activateGuest();
      setSession(null);
      onProfileChange();
      setMessage("");
    } catch {
      setMessage(
        t(
          "Не удалось завершить сессию на сервере. Повтори выход при подключении.",
          "Could not revoke the server session. Reconnect and try signing out again.",
        ),
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <View style={s.card}>
      {!account && store.hasLegacyData() && (
        <Text style={s.body}>
          {t(
            "Сохранены данные предыдущей версии. Войди в тот же аккаунт, чтобы восстановить историю и проверить неотправленные отметки.",
            "Data from the previous version is preserved. Sign in to the same account to restore history and review unsent check-ins.",
          )}
        </Text>
      )}
      <Text style={s.strong}>
        {account
          ? t("Синхронизация", "Sync")
          : t("Продолжить на другом устройстве", "Continue on another device")}
      </Text>
      <Text style={s.body}>
        {account
          ? t(
              `Ожидают отправки: ${snapshot.pending}. Конфликты: ${snapshot.conflicts}.`,
              `Waiting to send: ${snapshot.pending}. Conflicts: ${snapshot.conflicts}.`,
            )
          : t(
              "Аккаунт добавляет синхронизацию. При входе перенесём привычки и историю с этого устройства, сохранив локальную копию.",
              "An account adds sync. Signing in transfers your habits and history while keeping a local copy.",
            )}
      </Text>
      {Platform.OS === "web" ? (
        <Text style={s.muted}>
          {t(
            "Вход доступен в приложении для iOS и Android.",
            "Sign-in is available in the iOS and Android app.",
          )}
        </Text>
      ) : (
        <View style={s.wrap}>
          <AppleSignInButton
            busy={busy}
            onPress={() => {
              void connect(true);
            }}
          />
          {account && session && (
            <Action
              theme={theme}
              disabled={busy}
              onPress={() => {
                void synchronize();
              }}
            >
              {busy ? t("Обновляем…", "Updating…") : t("Синхронизировать", "Sync now")}
            </Action>
          )}
          <Action
            theme={theme}
            disabled={busy}
            onPress={() => {
              void connect();
            }}
          >
            {account
              ? t("Войти снова / другой аккаунт", "Sign in again / another account")
              : t("Войти и перенести данные", "Sign in and transfer data")}
          </Action>
          {account && (
            <Action
              theme={theme}
              disabled={busy}
              onPress={() => {
                void leave();
              }}
            >
              {t("Выйти", "Sign out")}
            </Action>
          )}
          {account && (
            <Action theme={theme} disabled={busy} onPress={() => setDeleting(true)}>
              {t("Удалить аккаунт", "Delete account")}
            </Action>
          )}
        </View>
      )}
      {deleting && account && (
        <View style={{ gap: 12 }}>
          <Text style={s.strong}>
            {t("Удалить аккаунт и историю?", "Delete your account and history?")}
          </Text>
          <Text style={s.body}>
            {t(
              "Будут удалены серверные данные, этот профиль и перенесённая гостевая копия на устройстве. Экспорты и резервные копии старой версии удаляются отдельно. Для подтверждения введи DELETE.",
              "Server data, this profile and its transferred guest copy on this device will be deleted. Exported files and legacy backups must be removed separately. Type DELETE to confirm.",
            )}
          </Text>
          <TextInput
            style={s.input}
            accessibilityLabel={t("Подтверждение удаления", "Deletion confirmation")}
            value={confirmation}
            autoCapitalize="characters"
            autoCorrect={false}
            onChangeText={setConfirmation}
          />
          <View style={s.wrap}>
            <Action
              theme={theme}
              disabled={busy}
              onPress={() => {
                setDeleting(false);
                setConfirmation("");
              }}
            >
              {t("Отмена", "Cancel")}
            </Action>
            <Action
              theme={theme}
              disabled={busy || confirmation !== "DELETE"}
              onPress={() => {
                void (async () => {
                  if (busy) return;
                  setBusy(true);
                  setMessage("");
                  const userId = snapshot.profileId.slice("account:".length);
                  try {
                    const clearCredential = await deleteMobileAccount(userId);
                    store.forgetAccount(userId);
                    await clearCredential();
                    setSession(null);
                    setDeleting(false);
                    setConfirmation("");
                    onProfileChange();
                  } catch {
                    setMessage(
                      t(
                        "Удаление не подтверждено. Подключись к сети и повтори; повторная отправка безопасна.",
                        "Deletion was not confirmed. Reconnect and retry; sending it again is safe.",
                      ),
                    );
                  } finally {
                    setBusy(false);
                    onChange();
                  }
                })();
              }}
            >
              {t("Удалить навсегда", "Delete permanently")}
            </Action>
          </View>
        </View>
      )}
      {message !== "" && (
        <Text accessibilityRole="alert" style={s.body}>
          {message}
        </Text>
      )}
      {store
        .outbox()
        .filter((item) => item.status === "conflict")
        .map((item) => {
          const operation = store.operation(item),
            result = JSON.parse(item.result!),
            local =
              operation.kind === "habit"
                ? (snapshot.habits.find((h) => h.id === operation.change.habit.id) ?? null)
                : null;
          const remote = store.remoteVersion(item);
          const habitId =
            operation.kind === "habit" ? operation.change.habit.id : operation.change.habitId;
          const entry =
            operation.kind === "entry"
              ? snapshot.entries.find(
                  (e) => e.habitId === habitId && e.localDate === operation.change.localDate,
                )
              : null;
          const title =
            snapshot.habits.find((h) => h.id === habitId)?.title ?? t("Привычка", "Habit");
          const description = (value: typeof local) => {
            if (!value) return t("Удалена", "Deleted");
            const schedule = scheduleAt(value.scheduleVersions, store.today());
            const cadence =
              schedule.kind === "daily"
                ? t("Каждый день", "Every day")
                : schedule.kind === "days_of_week"
                  ? t(
                      `Дни недели: ${schedule.days.join(", ")} (пн–вс)`,
                      `Weekdays: ${schedule.days.join(", ")} (Mon–Sun)`,
                    )
                  : schedule.kind === "times_per_week"
                    ? t(`${schedule.target} раз в неделю`, `${schedule.target} times a week`)
                    : schedule.kind === "times_per_month"
                      ? t(`${schedule.target} раз в месяц`, `${schedule.target} times a month`)
                      : t(`Раз в ${schedule.every} дн.`, `Every ${schedule.every} days`);
            return `${value.title} · ${value.archivedOn ? t("В архиве", "Archived") : t("Активна", "Active")} · ${value.targetValue ?? 1} ${value.unit} · ${cadence}`;
          };
          const amount = (value: typeof entry) =>
            !value || value.deleted
              ? t("Нет отметки", "No check-in")
              : `${value.value} · ${value.status === "skip" ? t("Пропуск", "Skipped") : value.status === "done" ? t("Выполнено", "Done") : t("В процессе", "In progress")}`;
          const choose = (choice: "local" | "remote") => {
            try {
              store.resolveConflict(item.id, choice);
              onChange();
              setMessage(
                t(
                  "Выбор сохранён. Обе версии доступны в экспорте.",
                  "Choice saved. Both versions are available in your export.",
                ),
              );
            } catch {
              setMessage(
                t(
                  "Это изменение пока нельзя применить. Сначала обнови данные.",
                  "This change cannot be applied yet. Refresh your data first.",
                ),
              );
            }
          };
          return (
            <View key={item.id} style={s.card}>
              <Text style={s.strong}>
                {title}
                {operation.kind === "entry" ? ` · ${operation.change.localDate}` : ""}
              </Text>
              <Text style={s.body}>
                {t("На устройстве: ", "On this device: ")}
                {operation.kind === "habit" ? description(local) : amount(entry)}
              </Text>
              <Text style={s.body}>
                {t("На сервере: ", "On the server: ")}
                {operation.kind === "habit"
                  ? description(remote as LocalHabit | null)
                  : amount(remote as LocalEntry | null)}
              </Text>
              <Text style={s.muted}>
                {t(
                  "Выбери версию. Обе останутся в истории конфликтов.",
                  "Choose a version. Both remain in conflict history.",
                )}
              </Text>
              {result.reason === "LEGACY_REVIEW" && (
                <Text style={s.body}>
                  {t(
                    "Это неотправленная отметка предыдущей версии. Проверь её перед применением.",
                    "This is an unsent check-in from the previous version. Review it before applying.",
                  )}
                </Text>
              )}
              {result.reason === "HISTORICAL_SCHEDULE_IMMUTABLE" && (
                <Text style={s.body}>
                  {t(
                    "Твоё расписание можно применить с сегодняшнего дня, сохранив прошлую историю.",
                    "Your schedule can apply from today while preserving past history.",
                  )}
                </Text>
              )}
              <View style={s.wrap}>
                {result.reason !== "HABIT_DELETED" && (
                  <Action theme={theme} disabled={busy} onPress={() => choose("local")}>
                    {result.reason === "HISTORICAL_SCHEDULE_IMMUTABLE"
                      ? t("Применить с сегодня", "Apply from today")
                      : t("Оставить мою", "Keep mine")}
                  </Action>
                )}
                <Action theme={theme} disabled={busy} onPress={() => choose("remote")}>
                  {t("Принять серверную", "Use server version")}
                </Action>
              </View>
            </View>
          );
        })}
    </View>
  );
}
