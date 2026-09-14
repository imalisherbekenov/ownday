import { useState } from "react";
import { Text, View } from "react-native";
import type { LocalStore } from "./local-store";
import type { JournalTheme } from "./journal-ui";
import { Action } from "./journal-ui";
export function WidgetReviewPanel({
  store,
  theme,
  t,
  onChange,
}: {
  store: LocalStore;
  theme: JournalTheme;
  t: (ru: string, en: string) => string;
  onChange: () => void;
}) {
  const [error, setError] = useState(false);
  const snapshot = store.snapshot();
  function resolve(id: string, widget: boolean) {
    try {
      store.resolveWidgetReview(id, widget);
      setError(false);
      onChange();
    } catch {
      setError(true);
    }
  }
  return (
    <>
      {store.widgetReviews().map((review) => {
        const habit = snapshot.habits.find((item) => item.id === review.intended.habitId);
        const current = snapshot.entries.find(
          (item) =>
            item.habitId === review.intended.habitId &&
            item.localDate === review.intended.localDate,
        );
        return (
          <View key={review.id} style={theme.s.card}>
            <Text style={theme.s.h2}>{t("Изменение из виджета", "A change from your widget")}</Text>
            <Text style={theme.s.body}>
              {habit?.title} · {review.intended.localDate}
            </Text>
            <Text style={theme.s.muted}>
              {t(
                "В приложении уже есть другое изменение. Обе версии сохранены.",
                "The app has another change. Both versions are preserved.",
              )}
            </Text>
            <Text style={theme.s.body}>
              {t("В приложении", "In the app")}: {current?.deleted ? 0 : (current?.value ?? 0)} ·{" "}
              {t("В виджете", "In the widget")}:{" "}
              {review.intended.deleted ? 0 : review.intended.value}
            </Text>
            <View style={theme.s.wrap}>
              <Action theme={theme} onPress={() => resolve(review.id, false)}>
                {t("Оставить в приложении", "Keep app value")}
              </Action>
              <Action theme={theme} onPress={() => resolve(review.id, true)}>
                {t("Применить из виджета", "Use widget value")}
              </Action>
            </View>
          </View>
        );
      })}
      {error && (
        <Text accessibilityRole="alert" style={theme.s.body}>
          {t(
            "Привычка недоступна на эту дату. Сохрани текущее значение или сначала восстанови расписание.",
            "The habit is unavailable on this date. Keep the current value or restore its schedule first.",
          )}
        </Text>
      )}
    </>
  );
}
