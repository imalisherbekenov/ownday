import { useState } from "react";
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import type { Schedule } from "@ownday/core";
import type { LocalHabit } from "./local-store";
import { Action, JournalIcon } from "./journal-ui";
import type { JournalTheme } from "./journal-ui";

export type HabitDraft = Pick<
  LocalHabit,
  "title" | "type" | "targetValue" | "unit" | "time" | "icon"
> & { schedule: Schedule };
export function HabitEditor({
  theme,
  t,
  initial,
  onClose,
  onSave,
}: {
  theme: JournalTheme;
  t: (ru: string, en: string) => string;
  initial?: Partial<HabitDraft> & { id?: string };
  onClose: () => void;
  onSave: (draft: HabitDraft) => void;
}) {
  const { s, c } = theme;
  const [title, setTitle] = useState(initial?.title ?? "");
  const [type, setType] = useState<LocalHabit["type"]>(initial?.type ?? "binary");
  const [target, setTarget] = useState(String(initial?.targetValue ?? 1));
  const [unit, setUnit] = useState(initial?.unit ?? t("раз", "times"));
  const [kind, setKind] = useState<Schedule["kind"]>(initial?.schedule?.kind ?? "daily");
  const [days, setDays] = useState(
    initial?.schedule?.kind === "days_of_week" ? initial.schedule.days : [1, 2, 3, 4, 5],
  );
  const [quota, setQuota] = useState(
    String(
      initial?.schedule &&
        (initial.schedule.kind === "times_per_week" || initial.schedule.kind === "times_per_month")
        ? initial.schedule.target
        : 3,
    ),
  );
  const [time, setTime] = useState<LocalHabit["time"]>(initial?.time ?? "morning");
  const [icon, setIcon] = useState(initial?.icon ?? "leaf");
  const [advanced, setAdvanced] = useState(false),
    [error, setError] = useState("");
  function submit() {
    const value = Number(target.replace(",", "."));
    if (!title.trim() || (type !== "binary" && (!Number.isFinite(value) || value <= 0))) {
      setError(t("Укажи название и положительную цель.", "Enter a name and a positive goal."));
      return;
    }
    const schedule: Schedule =
      kind === "daily"
        ? { kind }
        : kind === "days_of_week"
          ? { kind, days }
          : kind === "interval_days" && initial?.schedule?.kind === "interval_days"
            ? initial.schedule
            : {
                kind: kind === "times_per_month" ? "times_per_month" : "times_per_week",
                target: Number(quota),
              };
    if (schedule.kind === "days_of_week" && !days.length) {
      setError(t("Выбери хотя бы один день.", "Choose at least one day."));
      return;
    }
    if (
      (schedule.kind === "times_per_week" || schedule.kind === "times_per_month") &&
      (!Number.isInteger(schedule.target) ||
        schedule.target < 1 ||
        schedule.target > (schedule.kind === "times_per_week" ? 7 : 31))
    ) {
      setError(t("Проверь количество выполнений.", "Check the number of check-ins."));
      return;
    }
    onSave({
      title: title.trim(),
      type,
      targetValue: type === "binary" ? null : value,
      unit: type === "duration" ? t("мин", "min") : type === "binary" ? "" : unit,
      time,
      icon,
      schedule,
    });
  }
  return (
    <Modal animationType="slide" onRequestClose={onClose} presentationStyle="pageSheet">
      <SafeAreaView style={s.modal} accessibilityViewIsModal>
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === "ios" ? "padding" : "height"}
        >
          <ScrollView contentContainerStyle={s.page} keyboardShouldPersistTaps="handled">
            <View style={s.between}>
              <Text accessibilityRole="header" style={s.h2}>
                {initial?.id
                  ? t("О привычке", "Edit habit")
                  : t("Один маленький шаг", "One little step")}
              </Text>
              <Action theme={theme} onPress={onClose} label={t("Закрыть", "Close")}>
                <JournalIcon name="close" color={c.ink} />
              </Action>
            </View>
            <View style={{ gap: 8 }}>
              <Text style={s.strong}>
                {t("Что ты хочешь делать?", "What would you like to do?")}
              </Text>
              <TextInput
                autoFocus
                value={title}
                onChangeText={setTitle}
                maxLength={160}
                placeholder={t("Например, читать перед сном", "For example, read before bed")}
                placeholderTextColor={c["ink-2"]}
                style={s.input}
                accessibilityLabel={t("Название привычки", "Habit name")}
                returnKeyType="next"
              />
            </View>
            <View style={{ gap: 8 }}>
              <Text style={s.strong}>{t("Как отмечать?", "How will you track it?")}</Text>
              <View style={s.wrap}>
                {(["binary", "counter", "duration"] as const).map((value) => (
                  <Action
                    key={value}
                    theme={theme}
                    disabled={Boolean(initial?.id)}
                    selected={type === value}
                    onPress={() => setType(value)}
                  >
                    {value === "binary"
                      ? t("Галочка", "Check-in")
                      : value === "counter"
                        ? t("Количество", "Count")
                        : t("Минуты", "Minutes")}
                  </Action>
                ))}
              </View>
            </View>
            {type !== "binary" && (
              <View style={{ gap: 8 }}>
                <Text style={s.strong}>{t("Цель на одно выполнение", "Goal per check-in")}</Text>
                <TextInput
                  value={target}
                  onChangeText={setTarget}
                  keyboardType="decimal-pad"
                  style={s.input}
                  accessibilityLabel={t("Цель", "Goal")}
                />
              </View>
            )}
            <View style={{ gap: 8 }}>
              <Text style={s.strong}>{t("Твой ритм", "Your rhythm")}</Text>
              <View style={s.wrap}>
                {(["daily", "days_of_week", "times_per_week", "times_per_month"] as const).map(
                  (value) => (
                    <Action
                      key={value}
                      theme={theme}
                      selected={kind === value}
                      onPress={() => setKind(value)}
                    >
                      {value === "daily"
                        ? t("Ежедневно", "Daily")
                        : value === "days_of_week"
                          ? t("По дням", "Selected days")
                          : value === "times_per_week"
                            ? t("За неделю", "Per week")
                            : t("За месяц", "Per month")}
                    </Action>
                  ),
                )}
              </View>
            </View>
            {kind === "days_of_week" && (
              <View style={s.wrap}>
                {t("Пн Вт Ср Чт Пт Сб Вс", "Mon Tue Wed Thu Fri Sat Sun")
                  .split(" ")
                  .map((label, i) => (
                    <Action
                      key={i}
                      theme={theme}
                      selected={days.includes(i + 1)}
                      onPress={() =>
                        setDays(
                          days.includes(i + 1) ? days.filter((d) => d !== i + 1) : [...days, i + 1],
                        )
                      }
                    >
                      {label}
                    </Action>
                  ))}
              </View>
            )}
            {(kind === "times_per_week" || kind === "times_per_month") && (
              <TextInput
                value={quota}
                onChangeText={setQuota}
                keyboardType="number-pad"
                style={s.input}
                accessibilityLabel={t("Выполнений за период", "Check-ins per period")}
              />
            )}
            <Action theme={theme} selected={advanced} onPress={() => setAdvanced(!advanced)}>
              {t("Ещё настройки", "More options")}
            </Action>
            {advanced && (
              <View style={{ gap: 16 }}>
                <Text style={s.strong}>{t("Время для себя", "Your time of day")}</Text>
                <View style={s.wrap}>
                  {(["morning", "afternoon", "evening"] as const).map((value) => (
                    <Action
                      key={value}
                      theme={theme}
                      selected={time === value}
                      onPress={() => setTime(value)}
                    >
                      {value === "morning"
                        ? t("Утро", "Morning")
                        : value === "afternoon"
                          ? t("День", "Afternoon")
                          : t("Вечер", "Evening")}
                    </Action>
                  ))}
                </View>
                {type === "counter" && (
                  <TextInput
                    value={unit}
                    maxLength={32}
                    onChangeText={setUnit}
                    style={s.input}
                    accessibilityLabel={t("Единица измерения", "Unit")}
                  />
                )}
                <Text style={s.strong}>{t("Иконка", "Icon")}</Text>
                <View style={s.wrap}>
                  {["leaf", "water", "book", "sun", "moon"].map((name) => (
                    <Action
                      key={name}
                      theme={theme}
                      selected={icon === name}
                      label={t("Иконка ", "Icon ") + name}
                      onPress={() => setIcon(name)}
                    >
                      <JournalIcon name={name} color={c.ink} />
                    </Action>
                  ))}
                </View>
              </View>
            )}
            <Text style={s.muted}>
              {initial?.id
                ? t(
                    "Новое расписание действует с сегодняшнего дня. Прошлые дни сохраняются.",
                    "Schedule changes apply from today. Past days are preserved.",
                  )
                : t(
                    "Регистрация не нужна. Привычка сохранится на устройстве.",
                    "No account needed. Your habit stays on this device.",
                  )}
            </Text>
            {!!error && (
              <Text accessibilityRole="alert" style={[s.body, s.error]}>
                {error}
              </Text>
            )}
          </ScrollView>
          <View style={s.footer}>
            <Action theme={theme} primary onPress={submit}>
              {initial?.id
                ? t("Сохранить изменения", "Save changes")
                : t("Добавить в мой день", "Add to my day")}
            </Action>
          </View>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </Modal>
  );
}
