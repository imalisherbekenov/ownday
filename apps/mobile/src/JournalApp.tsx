import { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  AppState,
  BackHandler,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
  useColorScheme,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { useFonts } from "expo-font";
import { completionTotals, isoWeekday, scheduleAt } from "@ownday/core";
import type { EntryAction } from "@ownday/core";
import { getLocalStore } from "./storage";
import type { LocalHabit, LocalSnapshot, LocalStore } from "./local-store";
import { dailyProgress, habitMetrics, historyFor, scheduled, shiftDay } from "./journal-model";
import { Action, Botanical, JournalIcon, journalStyles } from "./journal-ui";
import { HabitEditor } from "./HabitEditor";
import { ValueEditor } from "./ValueEditor";
import { exportJournal } from "./export-journal";
import { AccountPanel } from "./AccountPanel";
import { WidgetReviewPanel } from "./WidgetReviewPanel";
import { syncForStore } from "./sync-engine";
import { credentials } from "./mobile-auth";
import { accountTransport } from "./account-transport";
import { ReminderPanel } from "./ReminderPanel";
import { reconcileNotifications, watchReminderResponses } from "./local-notifications";
import { updateJournalWidget } from "./widget-journal";
import type { HabitDraft } from "./HabitEditor";

type Page = "today" | "habits" | "progress" | "detail" | "settings";
export function JournalApp() {
  const [store, setStore] = useState<LocalStore | null>(null),
    [error, setError] = useState(false);
  const [fontsLoaded, fontError] = useFonts({
    Lora_600SemiBold: require("@expo-google-fonts/lora/600SemiBold/Lora_600SemiBold.ttf"),
    NunitoSans_400Regular: require("@expo-google-fonts/nunito-sans/400Regular/NunitoSans_400Regular.ttf"),
    NunitoSans_700Bold: require("@expo-google-fonts/nunito-sans/700Bold/NunitoSans_700Bold.ttf"),
  });
  const system = useColorScheme();
  function initialize() {
    setError(false);
    void getLocalStore()
      .then(setStore)
      .catch((cause) => {
        console.error("Ownday local database initialization failed", cause);
        setError(true);
      });
  }
  useEffect(() => {
    initialize();
  }, []);
  if (error)
    return (
      <SafeAreaView style={{ flex: 1, justifyContent: "center", padding: 24 }}>
        <Text>Не удалось открыть локальные данные / Could not open local data</Text>
        <Pressable onPress={initialize} accessibilityRole="button" style={{ padding: 20 }}>
          <Text>Повторить / Retry</Text>
        </Pressable>
      </SafeAreaView>
    );
  if (!store || (!fontsLoaded && !fontError))
    return (
      <View style={{ flex: 1, justifyContent: "center" }}>
        <ActivityIndicator accessibilityLabel="Ownday" />
      </View>
    );
  return <JournalHome store={store} systemDark={system === "dark"} />;
}

function JournalHome({ store, systemDark }: { store: LocalStore; systemDark: boolean }) {
  const [snapshot, setSnapshot] = useState(() => store.snapshot());
  const [today, setToday] = useState(() => store.today()),
    [date, setDate] = useState(() => store.today());
  const [page, setPage] = useState<Page>("today"),
    [selectedId, setSelectedId] = useState<string | null>(null);
  const [draft, setDraft] = useState<(Partial<HabitDraft> & { id?: string }) | null>(null);
  const [period, setPeriod] = useState(7),
    [query, setQuery] = useState(""),
    [archive, setArchive] = useState(false);
  const [undo, setUndo] = useState<{ habitId: string; date: string; action: EntryAction } | null>(
    null,
  );
  const [exact, setExact] = useState<{ habit: LocalHabit; value: number } | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const preferences = snapshot.preferences;
  const notificationState = JSON.stringify([
    snapshot.profileId,
    preferences,
    snapshot.habits,
    snapshot.entries,
    today,
  ]);
  const t = (ru: string, en: string) => (preferences.locale === "ru" ? ru : en);
  const theme = useMemo(
    () =>
      journalStyles(preferences.theme === "dark" || (preferences.theme === "system" && systemDark)),
    [preferences.theme, systemDark],
  );
  const { s, c } = theme,
    insets = useSafeAreaInsets();
  const format = (value: string, options: Intl.DateTimeFormatOptions) =>
    new Intl.DateTimeFormat(preferences.locale === "ru" ? "ru-RU" : "en-GB", {
      timeZone: "UTC",
      ...options,
    }).format(new Date(`${value}T12:00:00Z`));
  function refresh() {
    setSnapshot(store.snapshot());
    const next = store.today();
    setToday((old) => {
      if (old !== next) setDate((current) => (current === old ? next : current));
      return next;
    });
  }
  useEffect(() => {
    return watchReminderResponses(store, (habitId) => {
      setSelectedId(habitId);
      setPage("detail");
      setDraft(null);
    });
  }, [store]);
  useEffect(() => {
    if (Platform.OS !== "web") void reconcileNotifications(store).catch(() => {});
    void updateJournalWidget(store)
      .then((changed) => {
        if (changed) refresh();
      })
      .catch(() => {});
  }, [store, notificationState]);
  useEffect(() => {
    const timer = setInterval(refresh, 30000);
    const listener = AppState.addEventListener("change", (state) => {
      if (state === "active") {
        refresh();
        void updateJournalWidget(store)
          .then((changed) => {
            if (changed) refresh();
          })
          .catch(() => {});
        if (Platform.OS !== "web") void credentials().catch(() => {});
      }
    });
    return () => {
      clearInterval(timer);
      listener.remove();
    };
  }, [store]);
  useEffect(() => {
    if (Platform.OS === "web" || !snapshot.profileId.startsWith("account:")) return;
    let disposed = false;
    const profile = snapshot.profileId;
    const sync = async () => {
      try {
        const session = await credentials();
        if (
          disposed ||
          !session ||
          profile !== `account:${session.userId}` ||
          store.profileId !== profile
        )
          return;
        await syncForStore(store).run(session.userId, accountTransport(session));
        if (!disposed) refresh();
      } catch {
        /* Offline edits remain durable and retry on foreground, timer or explicit action. */
      }
    };
    const delay = setTimeout(() => {
        void sync();
      }, 1500),
      timer = setInterval(() => {
        void sync();
      }, 30000);
    const listener = AppState.addEventListener("change", (state) => {
      if (state === "active") void sync();
    });
    return () => {
      disposed = true;
      clearTimeout(delay);
      clearInterval(timer);
      listener.remove();
    };
  }, [store, snapshot.profileId, snapshot.pending]);
  useEffect(() => {
    if (Platform.OS !== "android") return;
    const listener = BackHandler.addEventListener("hardwareBackPress", () => {
      if (page !== "today") {
        setPage("today");
        return true;
      }
      return false;
    });
    return () => listener.remove();
  }, [page]);
  function run(fn: () => void) {
    try {
      fn();
      refresh();
      setNotice(null);
      return true;
    } catch {
      setNotice(
        t(
          "Проверь введённые данные и повтори. Уже сохранённые записи остаются на устройстве.",
          "Check the entered values and try again. Saved records remain on your device.",
        ),
      );
      return false;
    }
  }
  function mark(habit: LocalHabit, action: EntryAction) {
    return run(() => {
      const previous = snapshot.entries.find(
        (e) => e.habitId === habit.id && e.localDate === date && !e.deleted,
      );
      store.mark(habit.id, date, action);
      setUndo({
        habitId: habit.id,
        date,
        action: !previous
          ? { kind: "clear" }
          : { kind: "set", status: previous.status, value: previous.value },
      });
    });
  }
  const open = (habit: LocalHabit) => {
    setSelectedId(habit.id);
    setPage("detail");
  };
  const edit = (habit: LocalHabit) =>
    setDraft({ ...habit, schedule: scheduleAt(habit.scheduleVersions, today) });
  const timeLabel = (time: LocalHabit["time"]) =>
    time === "morning"
      ? t("Утро", "Morning")
      : time === "afternoon"
        ? t("День", "Afternoon")
        : t("Вечер", "Evening");
  function habitRow(habit: LocalHabit) {
    const entry = snapshot.entries.find(
      (e) => e.habitId === habit.id && e.localDate === date && !e.deleted,
    );
    const done = entry?.status === "done",
      skip = entry?.status === "skip",
      value = entry?.value ?? 0;
    const canMark = date <= today && scheduled(habit, date);
    const target = habit.targetValue ?? 1;
    return (
      <View key={habit.id} style={s.card}>
        <View style={s.row}>
          <View style={s.iconBox}>
            <JournalIcon name={habit.icon} color={c["done-ink"]} />
          </View>
          <Pressable style={{ flex: 1 }} onPress={() => open(habit)} accessibilityRole="button">
            <Text style={s.strong}>{habit.title}</Text>
            <Text style={s.muted}>
              {skip
                ? t("Осознанный пропуск", "Intentional pause")
                : habit.type === "binary"
                  ? done
                    ? t("Выполнено", "Completed")
                    : t("Маленький шаг для себя", "A little step for yourself")
                  : `${value} / ${target} ${habit.unit}`}
            </Text>
          </Pressable>
        </View>
        {habit.type !== "binary" && !skip && (
          <View
            accessibilityRole="progressbar"
            accessibilityLabel={habit.title}
            accessibilityValue={{ min: 0, max: target, now: Math.min(value, target) }}
            style={s.progress}
          >
            <View
              style={{
                height: 5,
                width: `${Math.min(100, (value / target) * 100)}%`,
                backgroundColor: c.done,
              }}
            />
          </View>
        )}
        <View style={s.wrap}>
          {habit.type !== "binary" && (
            <Action theme={theme} disabled={!canMark} onPress={() => setExact({ habit, value })}>
              {t("Ввести число", "Enter amount")}
            </Action>
          )}
          {habit.type !== "binary" && !skip && (
            <>
              <Action
                theme={theme}
                disabled={!canMark || value <= 0}
                label={t("Уменьшить: ", "Decrease: ") + habit.title}
                onPress={() =>
                  mark(habit, { kind: "increment", delta: habit.type === "duration" ? -5 : -1 })
                }
              >
                <JournalIcon name="minus" color={c.ink} />
              </Action>
              <Action
                theme={theme}
                disabled={!canMark}
                label={t("Увеличить: ", "Increase: ") + habit.title}
                onPress={() =>
                  mark(habit, { kind: "increment", delta: habit.type === "duration" ? 5 : 1 })
                }
              >
                <JournalIcon name="plus" color={c.ink} />
              </Action>
            </>
          )}
          <Action
            theme={theme}
            primary={done}
            disabled={!canMark}
            label={
              (done ? t("Отменить: ", "Undo: ") : t("Выполнить: ", "Complete: ")) + habit.title
            }
            onPress={() => mark(habit, done ? { kind: "clear" } : { kind: "set", status: "done" })}
          >
            <JournalIcon name="check" color={done ? c.ground : c.ink} />
            <Text style={[s.buttonText, done && s.primaryText]}>
              {done ? t("Готово", "Done") : t("Отметить", "Check in")}
            </Text>
          </Action>
          <Action
            theme={theme}
            disabled={!canMark}
            selected={skip}
            label={
              (skip ? t("Отменить пропуск: ", "Undo skip: ") : t("Пропустить: ", "Skip: ")) +
              habit.title
            }
            onPress={() => mark(habit, { kind: skip ? "unskip" : "skip" })}
          >
            <JournalIcon name="skip" color={c.ink} />
          </Action>
        </View>
        {!canMark && (
          <Text style={s.muted}>
            {date > today
              ? t("Этот день ещё впереди", "This day is still ahead")
              : t("На этот день не запланировано", "Not scheduled for this day")}
          </Text>
        )}
      </View>
    );
  }
  const current = snapshot.habits.find((h) => h.id === selectedId);
  const progress = dailyProgress(snapshot, date);
  const from = shiftDay(date, 1 - isoWeekday(date));
  const weekdays = Array.from({ length: 7 }, (_, i) => shiftDay(from, i));
  function template(kind: "water" | "book" | "walk") {
    setDraft(
      kind === "water"
        ? {
            title: t("Пить достаточно воды", "Stay hydrated"),
            type: "counter",
            targetValue: 8,
            unit: t("стак.", "glasses"),
            time: "morning",
            icon: "water",
          }
        : kind === "book"
          ? {
              title: t("Читать каждый день", "Read every day"),
              type: "counter",
              targetValue: 20,
              unit: t("стр.", "pages"),
              time: "evening",
              icon: "book",
            }
          : {
              title: t("Выйти на прогулку", "Take a walk"),
              type: "duration",
              targetValue: 30,
              unit: t("мин", "min"),
              time: "afternoon",
              icon: "leaf",
            },
    );
  }
  return (
    <SafeAreaView style={s.root} edges={["top", "left", "right"]}>
      <ScrollView key={page} contentContainerStyle={s.page} keyboardShouldPersistTaps="handled">
        <View style={s.between}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t("Сегодня", "Today")}
            onPress={() => {
              setPage("today");
              setDate(today);
            }}
          >
            <Text style={s.h2}>ownday.</Text>
          </Pressable>
          <Action
            theme={theme}
            label={t("Настройки", "Settings")}
            onPress={() => setPage("settings")}
          >
            <JournalIcon name="settings" color={c.ink} />
          </Action>
        </View>
        {page === "today" && (
          <>
            <View style={{ gap: 10 }}>
              <Text style={s.eyebrow}>
                {format(date, { weekday: "long", day: "numeric", month: "long" }).toLocaleUpperCase(
                  preferences.locale,
                )}
              </Text>
              <Text style={s.title} accessibilityRole="header">
                {t("Сегодня —\nв твоём ритме.", "Today,\nat your own pace.")}
              </Text>
              <Text style={s.muted}>
                {t(
                  "Не нужно успевать всё. Начни с того, что важно тебе.",
                  "You don’t have to do it all. Start with what matters to you.",
                )}
              </Text>
            </View>
            <View style={s.card}>
              <View style={s.between}>
                <Action
                  theme={theme}
                  label={t("Предыдущая неделя", "Previous week")}
                  onPress={() => setDate(shiftDay(date, -7))}
                >
                  <JournalIcon name="back" color={c.ink} />
                </Action>
                <Action theme={theme} onPress={() => setDate(today)}>
                  {t("Сегодня", "Today")}
                </Action>
                <Action
                  theme={theme}
                  label={t("Следующая неделя", "Next week")}
                  onPress={() => setDate(shiftDay(date, 7))}
                >
                  <JournalIcon name="next" color={c.ink} />
                </Action>
              </View>
              <View style={{ flexDirection: "row" }}>
                {weekdays.map((day) => (
                  <Pressable
                    key={day}
                    onPress={() => setDate(day)}
                    accessibilityRole="button"
                    accessibilityLabel={format(day, {
                      weekday: "long",
                      day: "numeric",
                      month: "long",
                    })}
                    accessibilityState={{ selected: date === day }}
                    style={[s.tab, date === day && s.selected]}
                  >
                    <Text style={s.tiny}>{format(day, { weekday: "short" })}</Text>
                    <Text style={s.strong}>{Number(day.slice(-2))}</Text>
                    <Text style={s.tiny}>
                      {dailyProgress(snapshot, day).rate === 1 ? "✓" : "·"}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </View>
            <View style={s.between}>
              <Text style={s.h2}>
                {t("Мой день", "My day")} · {progress.done}/{progress.due}
              </Text>
              <Action
                theme={theme}
                label={t("Добавить привычку", "Add habit")}
                onPress={() => setDraft({})}
              >
                <JournalIcon name="plus" color={c.ink} />
              </Action>
            </View>
            {snapshot.habits.length === 0 ? (
              <View style={s.card}>
                <Botanical theme={theme} />
                <Text style={s.h2}>
                  {t("Всё начинается\nс одной привычки.", "It starts with\none little habit.")}
                </Text>
                <Text style={s.body}>
                  {t(
                    "Стакан воды. Несколько страниц. Что сделает твой день немного лучше?",
                    "A glass of water. A few pages. What would make your day a little better?",
                  )}
                </Text>
                <Action theme={theme} primary onPress={() => setDraft({})}>
                  {t("Создать первую привычку", "Create your first habit")}
                </Action>
                <View style={s.wrap}>
                  {(["water", "book", "walk"] as const).map((kind) => (
                    <Action key={kind} theme={theme} onPress={() => template(kind)}>
                      {kind === "water"
                        ? t("Вода", "Water")
                        : kind === "book"
                          ? t("Чтение", "Reading")
                          : t("Прогулка", "A walk")}
                    </Action>
                  ))}
                </View>
                <Text style={s.muted}>
                  {t(
                    "Без регистрации. Сохранится на устройстве.",
                    "No account needed. Saved on your device.",
                  )}
                </Text>
              </View>
            ) : (
              ([] as LocalHabit["time"][]).concat("morning", "afternoon", "evening").map((time) => {
                const habits = snapshot.habits.filter((h) => h.time === time && scheduled(h, date));
                return (
                  habits.length > 0 && (
                    <View key={time} style={{ gap: 12 }}>
                      <Text style={s.eyebrow}>{timeLabel(time)}</Text>
                      {habits.map(habitRow)}
                    </View>
                  )
                );
              })
            )}
            {snapshot.habits.length > 0 && progress.due === 0 && (
              <Text style={s.body}>
                {t(
                  "На этот день нет обязательных шагов. Можно просто быть.",
                  "There are no planned steps today. Room to simply be.",
                )}
              </Text>
            )}
            {progress.due > 0 && progress.done === progress.due && (
              <View style={s.banner}>
                <Text style={s.h2}>
                  {t("Ты сделал место для себя.", "You made room for yourself.")}
                </Text>
                <Text style={s.muted}>
                  {t("Всё запланированное выполнено.", "Every planned habit is complete.")}
                </Text>
              </View>
            )}
            <Text style={s.muted}>
              {t(
                "Пауза — тоже часть пути. Пропуск не прерывает серию.",
                "A pause belongs here, too. Skipping preserves your streak.",
              )}
            </Text>
          </>
        )}
        {page === "habits" && (
          <>
            <Text style={s.title} accessibilityRole="header">
              {t("Твои маленькие\nопоры.", "Your little\nanchors.")}
            </Text>
            <TextInput
              value={query}
              onChangeText={setQuery}
              style={s.input}
              placeholder={t("Найти привычку", "Find a habit")}
              placeholderTextColor={c["ink-2"]}
              accessibilityLabel={t("Поиск привычек", "Search habits")}
            />
            <View style={s.wrap}>
              <Action theme={theme} selected={!archive} onPress={() => setArchive(false)}>
                {t("Активные", "Active")}
              </Action>
              <Action theme={theme} selected={archive} onPress={() => setArchive(true)}>
                {t("Архив", "Archive")}
              </Action>
              <Action theme={theme} onPress={() => setDraft({})}>
                {t("Добавить", "Add")}
              </Action>
            </View>
            {snapshot.habits
              .filter(
                (h) =>
                  Boolean(h.archivedOn) === archive &&
                  h.title
                    .toLocaleLowerCase(preferences.locale)
                    .includes(query.toLocaleLowerCase(preferences.locale)),
              )
              .map((h) => (
                <View key={h.id} style={s.card}>
                  <Pressable accessibilityRole="button" onPress={() => open(h)}>
                    <Text style={s.strong}>{h.title}</Text>
                    <Text style={s.muted}>{timeLabel(h.time)}</Text>
                  </Pressable>
                  <View style={s.wrap}>
                    <Action theme={theme} onPress={() => edit(h)}>
                      {t("Изменить", "Edit")}
                    </Action>
                    <Action
                      theme={theme}
                      onPress={() => run(() => store.archiveHabit(h.id, !archive))}
                    >
                      {archive ? t("Вернуть", "Restore") : t("В архив", "Archive")}
                    </Action>
                    <Action
                      theme={theme}
                      disabled={snapshot.habits[0]?.id === h.id}
                      onPress={() =>
                        run(() =>
                          store.reorder([
                            h.id,
                            ...snapshot.habits.filter((x) => x.id !== h.id).map((x) => x.id),
                          ]),
                        )
                      }
                    >
                      {t("В начало", "Move first")}
                    </Action>
                  </View>
                </View>
              ))}
          </>
        )}
        {page === "detail" && current && (
          <>
            <Action theme={theme} onPress={() => setPage("habits")}>
              {t("Все привычки", "All habits")}
            </Action>
            <Text style={s.title} accessibilityRole="header">
              {current.title}
            </Text>
            <Text style={s.muted}>
              {timeLabel(current.time)} · {current.targetValue ?? 1} {current.unit}
            </Text>
            <ReminderPanel
              key={current.id}
              store={store}
              habitId={current.id}
              theme={theme}
              t={t}
              onChange={refresh}
            />
            <View style={s.card}>
              <Text style={s.h2}>{t("Твоя история", "Your story")}</Text>
              <View style={s.between}>
                <Action
                  theme={theme}
                  label={t("Предыдущий месяц", "Previous month")}
                  onPress={() => setDate(shiftDay(`${date.slice(0, 7)}-01`, -1))}
                >
                  <JournalIcon name="back" color={c.ink} />
                </Action>
                <Text style={[s.strong, { flex: 1, textAlign: "center" }]}>
                  {format(date, { month: "long", year: "numeric" })}
                </Text>
                <Action
                  theme={theme}
                  label={t("Следующий месяц", "Next month")}
                  onPress={() => {
                    const month = new Date(`${date.slice(0, 7)}-01T12:00:00Z`);
                    month.setUTCMonth(month.getUTCMonth() + 1);
                    setDate(month.toISOString().slice(0, 10));
                  }}
                >
                  <JournalIcon name="next" color={c.ink} />
                </Action>
              </View>
              <View style={{ flexDirection: "row", flexWrap: "wrap" }}>
                {Array.from({ length: 42 }, (_, i) =>
                  shiftDay(`${date.slice(0, 7)}-01`, i + 1 - isoWeekday(`${date.slice(0, 7)}-01`)),
                ).map((day) => {
                  const entry = snapshot.entries.find(
                    (e) => e.habitId === current.id && e.localDate === day && !e.deleted,
                  );
                  return (
                    <Pressable
                      key={day}
                      accessibilityRole="button"
                      accessibilityLabel={`${format(day, { day: "numeric", month: "long" })}: ${entry?.status === "done" ? t("выполнено", "done") : entry?.status === "skip" ? t("пропуск", "skipped") : t("не выполнено", "incomplete")}`}
                      accessibilityState={{ selected: day === date }}
                      onPress={() => setDate(day)}
                      style={{
                        width: "14.285%",
                        minHeight: 52,
                        alignItems: "center",
                        justifyContent: "center",
                        borderRadius: 12,
                        backgroundColor: date === day ? c["done-soft"] : c.surface,
                        opacity: day.slice(0, 7) === date.slice(0, 7) ? 1 : 0.45,
                      }}
                    >
                      <Text style={s.body}>{Number(day.slice(-2))}</Text>
                      <Text style={s.tiny}>
                        {entry?.status === "done"
                          ? "✓"
                          : entry?.status === "skip"
                            ? "Ⅱ"
                            : entry && entry.value > 0
                              ? "·"
                              : "—"}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>
            <Text style={s.strong}>{format(date, { day: "numeric", month: "long" })}</Text>
            {habitRow(current)}
            <Metrics habit={current} snapshot={snapshot} today={today} t={t} theme={theme} />
            <Action theme={theme} onPress={() => edit(current)}>
              {t("Изменить привычку", "Edit habit")}
            </Action>
          </>
        )}
        {page === "progress" && (
          <>
            <Text style={s.title} accessibilityRole="header">
              {t("Прогресс,\nа не идеал.", "Progress,\nnot perfection.")}
            </Text>
            <Text style={s.muted}>
              {t(
                "Здесь видны усилия. Даже маленькие.",
                "Your effort shows here. Even the little things.",
              )}
            </Text>
            <View style={s.wrap}>
              {[7, 30].map((days) => (
                <Action
                  key={days}
                  theme={theme}
                  selected={period === days}
                  onPress={() => setPeriod(days)}
                >
                  {days === 7 ? t("Неделя", "Week") : t("Месяц", "Month")}
                </Action>
              ))}
            </View>
            <View style={s.card}>
              <Text style={s.h2}>{t("Ритм последних дней", "Your recent rhythm")}</Text>
              <View
                style={{
                  flexDirection: "row",
                  gap: period === 7 ? 6 : 2,
                  alignItems: "flex-end",
                  height: 120,
                }}
              >
                {Array.from({ length: period }, (_, i) => shiftDay(today, i - period + 1)).map(
                  (day) => {
                    const rate = dailyProgress(snapshot, day).rate;
                    return (
                      <View
                        key={day}
                        accessibilityLabel={`${format(day, { day: "numeric", month: "short" })}: ${rate === null ? t("нет плана", "not scheduled") : `${Math.round(rate * 100)}%`}`}
                        style={{
                          flex: 1,
                          height: Math.max(3, (rate ?? 0) * 110),
                          backgroundColor: rate === null ? c["surface-2"] : c.done,
                          borderRadius: 4,
                        }}
                      />
                    );
                  },
                )}
              </View>
              <Text style={s.muted}>
                {t(
                  "Доля выполненных привычек по дням; пропуски исключены.",
                  "Daily habit completion; skipped days are excluded.",
                )}
              </Text>
            </View>
            {snapshot.habits.length === 0 && (
              <Text style={s.body}>
                {t("Первая отметка начнёт твою историю.", "Your first check-in starts your story.")}
              </Text>
            )}
            {snapshot.habits.map((h) => (
              <Pressable key={h.id} accessibilityRole="button" onPress={() => open(h)}>
                <Metrics
                  habit={h}
                  snapshot={snapshot}
                  today={today}
                  period={period}
                  t={t}
                  theme={theme}
                />
              </Pressable>
            ))}
          </>
        )}
        {page === "settings" && (
          <>
            <Text accessibilityRole="header" style={s.title}>
              {t("Твоё пространство", "Your space")}
            </Text>
            <View style={s.card}>
              <Text style={s.strong}>{t("Язык", "Language")}</Text>
              <View style={s.wrap}>
                {(["ru", "en"] as const).map((locale) => (
                  <Action
                    key={locale}
                    theme={theme}
                    selected={preferences.locale === locale}
                    onPress={() => run(() => store.savePreferences({ locale }))}
                  >
                    {locale === "ru" ? "Русский" : "English"}
                  </Action>
                ))}
              </View>
              <Text style={s.strong}>{t("Оформление", "Appearance")}</Text>
              <View style={s.wrap}>
                {(["system", "light", "dark"] as const).map((value) => (
                  <Action
                    key={value}
                    theme={theme}
                    selected={preferences.theme === value}
                    onPress={() => run(() => store.savePreferences({ theme: value }))}
                  >
                    {value === "system"
                      ? t("Как в системе", "System")
                      : value === "light"
                        ? t("Светлое", "Light")
                        : t("Тёмное", "Dark")}
                  </Action>
                ))}
              </View>
            </View>
            <View style={s.card}>
              <Text style={s.strong}>{t("Начало дня, час", "Day starts at, hour")}</Text>
              <TextInput
                key={`hour-${preferences.dayStartHour}`}
                editable={!snapshot.profileId.startsWith("account:")}
                defaultValue={String(preferences.dayStartHour)}
                keyboardType="number-pad"
                style={s.input}
                accessibilityLabel={t("Час начала дня", "Day start hour")}
                onEndEditing={(event) =>
                  run(() => store.savePreferences({ dayStartHour: Number(event.nativeEvent.text) }))
                }
              />
              <Text style={s.strong}>{t("Часовой пояс", "Time zone")}</Text>
              <TextInput
                key={`tz-${preferences.timezone}`}
                editable={!snapshot.profileId.startsWith("account:")}
                defaultValue={preferences.timezone}
                autoCapitalize="none"
                style={s.input}
                accessibilityLabel={t("Часовой пояс", "Time zone")}
                onEndEditing={(event) =>
                  run(() => store.savePreferences({ timezone: event.nativeEvent.text.trim() }))
                }
              />
              <Text style={s.muted}>
                {t(
                  snapshot.profileId.startsWith("account:")
                    ? "Часовой пояс и начало дня аккаунта меняются в настройках веб-версии и обновляются при синхронизации."
                    : "Изменение настроек не переносит прошлые отметки на другие даты.",
                  snapshot.profileId.startsWith("account:")
                    ? "Change your account time zone and day boundary in web settings. They update here during sync."
                    : "Changing settings never moves previous check-ins to other dates.",
                )}
              </Text>
            </View>
            <View style={s.card}>
              <Text style={s.strong}>
                {snapshot.profileId.startsWith("guest")
                  ? t("На этом устройстве", "On this device")
                  : t("Твой аккаунт", "Your account")}
              </Text>
              <Text style={s.body}>
                {t(
                  "Привычки и история хранятся локально и доступны без интернета.",
                  "Habits and history are stored locally and work without internet.",
                )}
              </Text>
              <Action
                theme={theme}
                onPress={() => {
                  void exportJournal(store.exportData()).catch(() =>
                    setNotice(
                      t("Экспорт не удался. Попробуй ещё раз.", "Export failed. Please try again."),
                    ),
                  );
                }}
              >
                {t("Экспортировать данные", "Export data")}
              </Action>
            </View>
            <WidgetReviewPanel store={store} theme={theme} t={t} onChange={refresh} />
            <AccountPanel
              store={store}
              snapshot={snapshot}
              theme={theme}
              t={t}
              onChange={refresh}
              onProfileChange={() => {
                setUndo(null);
                setDraft(null);
                setExact(null);
                setSelectedId(null);
                setQuery("");
                setDate(store.today());
                refresh();
              }}
            />
          </>
        )}
      </ScrollView>
      {store.widgetReviews().length > 0 && page !== "settings" && (
        <View style={[s.banner, { margin: 12 }]}>
          <Action theme={theme} onPress={() => setPage("settings")}>
            {t("Проверить изменения из виджета", "Review widget changes")}
          </Action>
        </View>
      )}
      {notice && (
        <View style={[s.banner, { margin: 12 }]}>
          <Text accessibilityRole="alert" style={s.body}>
            {notice}
          </Text>
          <Action theme={theme} onPress={() => setNotice(null)}>
            {t("Закрыть", "Dismiss")}
          </Action>
        </View>
      )}
      {undo && (
        <View style={[s.banner, { marginHorizontal: 12, marginBottom: 8 }]}>
          <View style={s.between}>
            <Text style={[s.muted, { flex: 1 }]}>
              {t("Сохранено на устройстве", "Saved on device")}
            </Text>
            <Action
              theme={theme}
              onPress={() =>
                run(() => {
                  store.mark(undo.habitId, undo.date, undo.action);
                  setUndo(null);
                })
              }
            >
              {t("Отменить", "Undo")}
            </Action>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t("Закрыть уведомление", "Dismiss")}
              onPress={() => setUndo(null)}
              style={{ padding: 12 }}
            >
              <JournalIcon name="close" color={c.ink} />
            </Pressable>
          </View>
        </View>
      )}
      <View style={[s.tabs, { paddingBottom: Math.max(insets.bottom, 8) }]}>
        {(["today", "habits", "progress"] as const).map((value) => (
          <Pressable
            key={value}
            accessibilityRole="tab"
            accessibilityState={{ selected: page === value }}
            onPress={() => setPage(value)}
            style={[s.tab, page === value && s.selected]}
          >
            <JournalIcon
              name={value === "today" ? "sun" : value === "habits" ? "grid" : "chart"}
              color={c.ink}
            />
            <Text style={s.tiny}>
              {value === "today"
                ? t("Сегодня", "Today")
                : value === "habits"
                  ? t("Привычки", "Habits")
                  : t("Прогресс", "Progress")}
            </Text>
          </Pressable>
        ))}
      </View>
      {draft && (
        <HabitEditor
          theme={theme}
          t={t}
          initial={draft}
          onClose={() => setDraft(null)}
          onSave={(input) =>
            run(() => {
              if (draft.id) store.editHabit(draft.id, input);
              else store.createHabit(input);
              setDraft(null);
              setPage("today");
              setDate(today);
            })
          }
        />
      )}
      {exact && (
        <ValueEditor
          theme={theme}
          t={t}
          title={exact.habit.title}
          value={exact.value}
          onClose={() => setExact(null)}
          onSave={(value) => {
            if (mark(exact.habit, { kind: "set", status: "done", value })) setExact(null);
          }}
        />
      )}
    </SafeAreaView>
  );
}
function Metrics({
  habit,
  snapshot,
  today,
  period = 30,
  t,
  theme,
}: {
  habit: LocalHabit;
  snapshot: LocalSnapshot;
  today: string;
  period?: number;
  t: (ru: string, en: string) => string;
  theme: ReturnType<typeof journalStyles>;
}) {
  const { streak, rate } = habitMetrics(snapshot, habit, today, period),
    from = shiftDay(today, 1 - period);
  const counts = completionTotals({
    versions: habit.scheduleVersions,
    entries: historyFor(snapshot, habit, today),
    startedOn: habit.startedOn > from ? habit.startedOn : from,
    today,
  });
  return (
    <View style={theme.s.card}>
      <Text style={theme.s.strong}>{habit.title}</Text>
      <View style={theme.s.between}>
        <Text style={theme.s.h2}>{rate === null ? "—" : `${Math.round(rate * 100)}%`}</Text>
        <Text style={theme.s.muted}>
          {counts.done}/{counts.due} · {period} {t("дн.", "days")}
        </Text>
      </View>
      <Text style={theme.s.muted}>
        {t("Серия: ", "Streak: ")}
        {streak.current}{" "}
        {streak.unit === "day"
          ? t("дн.", "days")
          : streak.unit === "week"
            ? t("нед.", "weeks")
            : t("мес.", "months")}{" "}
        · {t("Лучшая: ", "Best: ")}
        {streak.best}
      </Text>
    </View>
  );
}
