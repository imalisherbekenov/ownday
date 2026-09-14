import { useState } from "react";
import { Linking, Platform, Text, TextInput, View } from "react-native";
import type { LocalStore } from "./local-store";
import { Action } from "./journal-ui";
import type { JournalTheme } from "./journal-ui";
import { requestReminderPermission, reconcileNotifications } from "./local-notifications";
export function ReminderPanel({
  store,
  habitId,
  theme,
  t,
  onChange,
}: {
  store: LocalStore;
  habitId: string;
  theme: JournalTheme;
  t: (ru: string, en: string) => string;
  onChange: () => void;
}) {
  const saved = store.snapshot().preferences.reminders?.[habitId];
  const [time, setTime] = useState(saved ?? "09:00"),
    [message, setMessage] = useState(""),
    [busy, setBusy] = useState(false);
  const { s } = theme;
  async function save(enabled: boolean) {
    setBusy(true);
    setMessage("");
    try {
      if (enabled && !/^([01]\d|2[0-3]):[0-5]\d$/.test(time)) throw new Error("INVALID_TIME");
      if (enabled && !(await requestReminderPermission())) {
        setMessage(
          t(
            "Разреши уведомления в настройках устройства.",
            "Allow notifications in device settings.",
          ),
        );
        return;
      }
      store.saveReminder(habitId, enabled ? time : null);
      onChange();
      await reconcileNotifications(store);
      setMessage(
        enabled
          ? t("Напоминание сохранено.", "Reminder saved.")
          : t("Напоминание выключено.", "Reminder turned off."),
      );
    } catch {
      setMessage(
        t(
          "Проверь время в формате 09:00 и разрешение уведомлений.",
          "Check the time (09:00) and your notification permission.",
        ),
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <View style={s.card}>
      <Text style={s.h2}>{t("Мягкое напоминание", "A gentle reminder")}</Text>
      {Platform.OS === "web" ? (
        <Text style={s.muted}>
          {t(
            "Локальные уведомления доступны в приложении для iOS и Android.",
            "Local notifications are available in the iOS and Android app.",
          )}
        </Text>
      ) : (
        <>
          <Text style={s.body}>
            {saved
              ? t(`В ${saved}, в дни привычки.`, `At ${saved}, on scheduled days.`)
              : t("Сейчас выключено.", "Currently off.")}
          </Text>
          <TextInput
            value={time}
            onChangeText={setTime}
            style={s.input}
            keyboardType="numbers-and-punctuation"
            placeholder="09:00"
            accessibilityLabel={t("Время напоминания", "Reminder time")}
          />
          <View style={s.wrap}>
            <Action
              theme={theme}
              disabled={busy}
              onPress={() => {
                void save(true);
              }}
            >
              {t("Сохранить время", "Save time")}
            </Action>
            {saved && (
              <Action
                theme={theme}
                disabled={busy}
                onPress={() => {
                  void save(false);
                }}
              >
                {t("Выключить", "Turn off")}
              </Action>
            )}
            <Action
              theme={theme}
              onPress={() => {
                void Linking.openSettings();
              }}
            >
              {t("Разрешения", "Permissions")}
            </Action>
          </View>
          <Text style={s.muted}>
            {t(
              "Сохраняем до 60 ближайших напоминаний на срок до 14 дней и обновляем при открытии приложения. Время доставки зависит от настроек энергосбережения.",
              "We save up to 60 upcoming reminders for up to 14 days and refresh them when you open the app. Delivery timing depends on power-saving settings.",
            )}
          </Text>
          {message !== "" && (
            <Text accessibilityRole="alert" style={s.body}>
              {message}
            </Text>
          )}
        </>
      )}
    </View>
  );
}
