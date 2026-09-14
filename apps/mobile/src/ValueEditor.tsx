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
import { Action } from "./journal-ui";
import type { JournalTheme } from "./journal-ui";
export function ValueEditor({
  theme,
  t,
  title,
  value,
  onSave,
  onClose,
}: {
  theme: JournalTheme;
  t: (ru: string, en: string) => string;
  title: string;
  value: number;
  onSave: (value: number) => void;
  onClose: () => void;
}) {
  const [text, setText] = useState(String(value)),
    [error, setError] = useState(false);
  const save = () => {
    const number = Number(text.replace(",", "."));
    if (
      !text.trim() ||
      !Number.isFinite(number) ||
      number < 0 ||
      number > 999999999.999 ||
      Math.abs(number * 1000 - Math.round(number * 1000)) > 0.0001
    ) {
      setError(true);
      return;
    }
    onSave(number);
  };
  return (
    <Modal onRequestClose={onClose} animationType="slide" presentationStyle="pageSheet">
      <SafeAreaView style={theme.s.modal}>
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === "ios" ? "padding" : "height"}
        >
          <ScrollView contentContainerStyle={theme.s.page} keyboardShouldPersistTaps="handled">
            <Text accessibilityRole="header" style={theme.s.h2}>
              {title}
            </Text>
            <Text style={theme.s.body}>
              {t("Точное количество за день", "Exact amount for the day")}
            </Text>
            <TextInput
              autoFocus
              value={text}
              onChangeText={setText}
              keyboardType="decimal-pad"
              style={theme.s.input}
              accessibilityLabel={t("Количество", "Amount")}
            />
            {error && (
              <Text accessibilityRole="alert" style={theme.s.error}>
                {t(
                  "Введи число от 0, не более трёх знаков после запятой.",
                  "Enter a number from 0 with up to three decimal places.",
                )}
              </Text>
            )}
          </ScrollView>
          <View style={theme.s.footer}>
            <Action theme={theme} primary onPress={save}>
              {t("Сохранить", "Save")}
            </Action>
            <Action theme={theme} onPress={onClose}>
              {t("Отмена", "Cancel")}
            </Action>
          </View>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </Modal>
  );
}
