import { useEffect, useMemo, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, useColorScheme, View } from "react-native";
import {
  useFonts as useHanken,
  HankenGrotesk_400Regular,
  HankenGrotesk_500Medium,
  HankenGrotesk_700Bold,
  HankenGrotesk_800ExtraBold,
} from "@expo-google-fonts/hanken-grotesk";
import {
  useFonts as useMono,
  JetBrainsMono_500Medium,
  JetBrainsMono_600SemiBold,
} from "@expo-google-fonts/jetbrains-mono";
import { useQuery } from "@tanstack/react-query";
import { StatusBar } from "expo-status-bar";
import Svg, { Circle } from "react-native-svg";
import { tokens } from "@ownday/tokens";
import { clientIdFor, optimisticStreak, streakPillMode } from "./domain";
import { apiUrl, mutationQueue, trpc, watchNetwork } from "./api";
import type { Bootstrap, TodayHabit } from "./types";
import * as WebBrowser from "expo-web-browser";
import * as Linking from "expo-linking";
import { queryClient } from "./query";

type Palette = Record<keyof typeof tokens.color.light, string>;
const ui = tokens.typography.scale;

function WeekRing({
  value,
  selected,
  palette,
}: {
  value: number;
  selected: boolean;
  palette: Palette;
}) {
  const radius = 12;
  const circumference = 2 * Math.PI * radius;
  return (
    <View style={styles.ringWrap}>
      <Svg width={30} height={30}>
        <Circle
          cx={15}
          cy={15}
          r={radius}
          stroke={palette["surface-2"]}
          strokeWidth={3}
          fill={selected ? palette.ink : palette.surface}
        />
        <Circle
          cx={15}
          cy={15}
          r={radius}
          stroke={palette.done}
          strokeWidth={3}
          fill="none"
          strokeDasharray={`${circumference} ${circumference}`}
          strokeDashoffset={circumference * (1 - value)}
          strokeLinecap="round"
          rotation={-90}
          origin="15, 15"
        />
      </Svg>
    </View>
  );
}

function StreakPill({
  current,
  best,
  palette,
}: {
  current: number;
  best: number;
  palette: Palette;
}) {
  const mode = streakPillMode(current, best);
  if (mode === "hidden") return null;
  const hot = mode === "streak";
  return (
    <View
      style={[
        styles.pill,
        { backgroundColor: hot ? palette["streak-soft"] : palette["surface-2"] },
      ]}
    >
      <Text style={[styles.numSmall, { color: hot ? palette["streak-ink"] : palette["ink-3"] }]}>
        ♨ {current}
      </Text>
    </View>
  );
}

function HabitRow({
  item,
  palette,
  onToggle,
}: {
  item: TodayHabit;
  palette: Palette;
  onToggle: (item: TodayHabit) => void;
}) {
  const done = item.entry?.status === "done";
  const value = item.entry?.value ?? 0;
  const target = item.habit.targetValue ?? 1;
  const numeric = item.habit.type !== "binary";
  return (
    <View style={[styles.row, { borderBottomColor: palette["line-soft"] }]}>
      <Pressable
        accessibilityRole="checkbox"
        accessibilityState={{ checked: done }}
        hitSlop={10}
        onPress={() => onToggle(item)}
        style={[
          styles.check,
          {
            borderColor: done ? palette.done : palette.line,
            backgroundColor: done ? palette.done : palette.surface,
          },
        ]}
      >
        {done && <Text style={[styles.checkmark, { color: palette.surface }]}>✓</Text>}
      </Pressable>
      <View style={styles.rowBody}>
        <View style={styles.titleLine}>
          <View
            style={[
              styles.iconTile,
              {
                backgroundColor: palette[item.habit.color as keyof Palette] ?? palette["hue-moss"],
              },
            ]}
          >
            <Text>{item.habit.icon}</Text>
          </View>
          <View style={styles.titleBody}>
            <Text
              style={[
                styles.title,
                done && styles.doneTitle,
                { color: done ? palette["ink-3"] : palette.ink },
              ]}
            >
              {item.habit.title}
            </Text>
            <Text style={[styles.caption, { color: palette["ink-3"] }]}>
              {numeric ? `${value} / ${target} ${item.habit.unit ?? ""}` : "Ежедневно"}
            </Text>
          </View>
        </View>
        {numeric && (
          <View style={styles.numericLine}>
            <View style={[styles.progressTrack, { backgroundColor: palette["surface-2"] }]}>
              <View
                style={[
                  styles.progressFill,
                  {
                    backgroundColor: palette.done,
                    width: `${Math.min(100, (value / target) * 100)}%`,
                  },
                ]}
              />
            </View>
            <View style={[styles.stepper, { backgroundColor: palette["surface-2"] }]}>
              <Text style={[styles.numLarge, { color: palette.ink }]}>− {value} +</Text>
            </View>
          </View>
        )}
      </View>
      <StreakPill current={item.streak.current} best={item.streak.best} palette={palette} />
    </View>
  );
}

export function TodayScreen() {
  const scheme = useColorScheme();
  const palette = scheme === "dark" ? tokens.color.dark : tokens.color.light;
  const [pending, setPending] = useState(0);
  const [hanken] = useHanken({
    HankenGrotesk_400Regular,
    HankenGrotesk_500Medium,
    HankenGrotesk_700Bold,
    HankenGrotesk_800ExtraBold,
  });
  const [mono] = useMono({ JetBrainsMono_500Medium, JetBrainsMono_600SemiBold });
  const query = useQuery({
    queryKey: ["mobile.bootstrap"],
    queryFn: () => trpc.query("mobile.bootstrap") as Promise<Bootstrap>,
  });
  useEffect(() => watchNetwork(() => void mutationQueue.size().then(setPending)), []);
  const days = useMemo(() => ["П", "В", "С", "Ч", "П", "С", "В"], []);
  if (!hanken || !mono) return null;
  const login = async () => {
    const returnUrl = Linking.createURL("auth/callback");
    await WebBrowser.openAuthSessionAsync(
      `${apiUrl}/api/auth/mobile/session?returnUrl=${encodeURIComponent(returnUrl)}`,
      returnUrl,
    );
  };
  const toggle = async (item: TodayHabit) => {
    const status = item.entry?.status === "done" ? "miss" : "done";
    const mutation = {
      habitId: item.habit.id,
      localDate: item.localDate,
      status,
      clientId: clientIdFor(item.habit.id, item.localDate),
    } as const;
    queryClient.setQueryData<Bootstrap>(["mobile.bootstrap"], (old) =>
      old
        ? {
            ...old,
            today: old.today.map((candidate) =>
              candidate.habit.id === item.habit.id
                ? {
                    ...candidate,
                    entry: { localDate: item.localDate, status },
                    streak: optimisticStreak(
                      {
                        id: item.habit.id,
                        startedOn: item.startedOn,
                        scheduleVersions: item.habit.scheduleVersions,
                        entries: item.entries,
                      },
                      item.localDate,
                      status,
                    ),
                  }
                : candidate,
            ),
          }
        : old,
    );
    await mutationQueue.enqueue(mutation);
    setPending(await mutationQueue.size());
    void mutationQueue
      .flush()
      .then(async () => setPending(await mutationQueue.size()))
      .catch(() => undefined);
  };
  return (
    <View style={[styles.screen, { backgroundColor: palette.ground }]}>
      <StatusBar style={scheme === "dark" ? "light" : "dark"} />
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.header}>
          <View>
            <Text style={[styles.eyebrow, { color: palette["ink-3"] }]}>СЕГОДНЯ</Text>
            <Text style={[styles.heading, { color: palette.ink }]}>Доброе утро</Text>
            <Text style={[styles.caption, { color: palette["ink-3"] }]}>
              Ваши привычки на сегодня
            </Text>
          </View>
          {pending > 0 && (
            <View style={[styles.pending, { backgroundColor: palette["streak-soft"] }]}>
              <Text style={[styles.caption, { color: palette["streak-ink"] }]}>
                ↻ {pending} не синхр.
              </Text>
            </View>
          )}
        </View>
        <View style={styles.week}>
          {days.map((day, index) => (
            <View key={`${day}-${index}`} style={styles.day}>
              <Text style={[styles.dayLabel, { color: palette["ink-3"] }]}>{day}</Text>
              <Text style={[styles.dayNumber, { color: palette.ink }]}>{index + 19}</Text>
              <WeekRing
                value={index < 3 ? 1 : index === 3 ? 0.5 : 0}
                selected={index === 3}
                palette={palette}
              />
            </View>
          ))}
        </View>
        {query.isError ? (
          <Pressable onPress={login} style={[styles.login, { backgroundColor: palette.ink }]}>
            <Text style={[styles.buttonText, { color: palette.surface }]}>Войти через веб</Text>
          </Pressable>
        ) : (
          <View style={[styles.card, { backgroundColor: palette.surface }]}>
            {query.data?.today.map((item) => (
              <HabitRow key={item.habit.id} item={item} palette={palette} onToggle={toggle} />
            ))}
          </View>
        )}
        <Pressable style={[styles.add, { backgroundColor: palette.ink }]}>
          <Text style={[styles.buttonText, { color: palette.surface }]}>＋ Добавить привычку</Text>
        </Pressable>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: { paddingHorizontal: tokens.layout["page-margin"], paddingTop: 56, paddingBottom: 32 },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  eyebrow: {
    fontFamily: "HankenGrotesk_700Bold",
    fontSize: ui.label.size,
    lineHeight: ui.label.line,
    letterSpacing: 1.6,
  },
  heading: {
    fontFamily: "HankenGrotesk_800ExtraBold",
    fontSize: ui.h2.size,
    lineHeight: ui.h2.line,
  },
  caption: {
    fontFamily: "HankenGrotesk_400Regular",
    fontSize: ui.caption.size,
    lineHeight: ui.caption.line,
  },
  pending: { borderRadius: tokens.radius.chip, paddingHorizontal: 8, paddingVertical: 4 },
  week: { flexDirection: "row", justifyContent: "space-between", marginVertical: 24 },
  day: { alignItems: "center", minWidth: 38 },
  dayLabel: { fontFamily: "HankenGrotesk_700Bold", fontSize: 10 },
  dayNumber: { fontFamily: "JetBrainsMono_500Medium", fontSize: 13, marginVertical: 4 },
  ringWrap: { height: 30 },
  card: { borderRadius: tokens.radius.card, overflow: "hidden", elevation: 2 },
  row: {
    minHeight: 72,
    borderBottomWidth: StyleSheet.hairlineWidth,
    padding: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  check: {
    width: 24,
    height: 24,
    borderWidth: 2,
    borderRadius: tokens.radius.check,
    alignItems: "center",
    justifyContent: "center",
  },
  checkmark: { fontSize: 16, fontWeight: "700" },
  rowBody: { flex: 1, gap: 8 },
  titleLine: { flexDirection: "row", alignItems: "center", gap: 8 },
  iconTile: {
    width: 32,
    height: 32,
    borderRadius: tokens.radius.check,
    alignItems: "center",
    justifyContent: "center",
  },
  titleBody: { flex: 1 },
  title: {
    fontFamily: "HankenGrotesk_500Medium",
    fontSize: ui.body.size,
    lineHeight: ui.body.line,
    flexShrink: 1,
  },
  doneTitle: { textDecorationLine: "line-through" },
  numericLine: { flexDirection: "row", alignItems: "center", gap: 8 },
  progressTrack: { height: 6, borderRadius: 99, flex: 1, overflow: "hidden" },
  progressFill: { height: 6, borderRadius: 99 },
  stepper: {
    minHeight: 44,
    borderRadius: tokens.radius.check,
    justifyContent: "center",
    paddingHorizontal: 8,
  },
  numLarge: { fontFamily: "JetBrainsMono_600SemiBold", fontSize: 14 },
  pill: { borderRadius: 99, paddingHorizontal: 8, paddingVertical: 4 },
  numSmall: { fontFamily: "JetBrainsMono_500Medium", fontSize: ui["num-sm"].size },
  add: {
    minHeight: tokens.layout["tap-target"],
    borderRadius: tokens.radius.input,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 12,
  },
  login: {
    minHeight: 52,
    borderRadius: tokens.radius.input,
    alignItems: "center",
    justifyContent: "center",
  },
  buttonText: { fontFamily: "HankenGrotesk_700Bold", fontSize: ui.body.size },
});
