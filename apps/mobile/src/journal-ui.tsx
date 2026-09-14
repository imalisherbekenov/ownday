import { Pressable, StyleSheet, Text, View } from "react-native";
import type { ReactNode } from "react";
import Svg, { Path, Circle } from "react-native-svg";
import { light, dark, tokens } from "@ownday/tokens";

export function journalStyles(night: boolean) {
  const c = night ? dark : light;
  return {
    c,
    s: StyleSheet.create({
      root: { flex: 1, backgroundColor: c.ground },
      page: {
        padding: 20,
        paddingBottom: 32,
        gap: 20,
        width: "100%",
        maxWidth: 900,
        alignSelf: "center",
      },
      row: { flexDirection: "row", alignItems: "center", gap: 12 },
      between: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 12,
      },
      title: { fontFamily: "Lora_600SemiBold", fontSize: 32, lineHeight: 42, color: c.ink },
      h2: { fontFamily: "Lora_600SemiBold", fontSize: 23, lineHeight: 32, color: c.ink },
      body: { fontFamily: "NunitoSans_400Regular", fontSize: 16, lineHeight: 24, color: c.ink },
      strong: { fontFamily: "NunitoSans_700Bold", fontSize: 16, lineHeight: 24, color: c.ink },
      muted: {
        fontFamily: "NunitoSans_400Regular",
        fontSize: 14,
        lineHeight: 21,
        color: c["ink-2"],
      },
      eyebrow: {
        fontFamily: "NunitoSans_700Bold",
        fontSize: 12,
        lineHeight: 18,
        letterSpacing: 1.2,
        color: c["ink-2"],
      },
      card: {
        padding: 16,
        borderRadius: tokens.radius.card,
        backgroundColor: c.surface,
        borderWidth: 1,
        borderColor: c["line-soft"],
        gap: 12,
      },
      input: {
        minHeight: 48,
        borderWidth: 1,
        borderColor: c.line,
        borderRadius: tokens.radius.input,
        paddingHorizontal: 16,
        paddingVertical: 12,
        fontSize: 16,
        color: c.ink,
        fontFamily: "NunitoSans_400Regular",
        backgroundColor: c.surface,
      },
      button: {
        minHeight: 44,
        paddingHorizontal: 16,
        paddingVertical: 12,
        borderRadius: tokens.radius.chip,
        backgroundColor: c["surface-2"],
        alignItems: "center",
        justifyContent: "center",
        flexDirection: "row",
        gap: 8,
      },
      primary: { backgroundColor: c.ink },
      buttonText: { fontSize: 15, fontFamily: "NunitoSans_700Bold", color: c.ink },
      primaryText: { color: c.ground },
      wrap: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
      rule: { height: 1, backgroundColor: c["line-soft"] },
      tabs: {
        flexDirection: "row",
        borderTopWidth: 1,
        borderTopColor: c.line,
        paddingHorizontal: 8,
        paddingTop: 8,
        backgroundColor: c.surface,
      },
      tab: {
        flex: 1,
        minHeight: 58,
        alignItems: "center",
        justifyContent: "center",
        gap: 4,
        borderRadius: 12,
        paddingVertical: 8,
      },
      tiny: { fontFamily: "NunitoSans_700Bold", fontSize: 12, color: c["ink-2"] },
      selected: { backgroundColor: c["done-soft"] },
      iconBox: {
        height: 42,
        width: 42,
        alignItems: "center",
        justifyContent: "center",
        borderRadius: 14,
        backgroundColor: c["done-soft"],
      },
      progress: { height: 5, backgroundColor: c["surface-2"], borderRadius: 4, overflow: "hidden" },
      banner: { padding: 14, backgroundColor: c["surface-2"], borderRadius: 16 },
      error: { color: c.miss },
      modal: { flex: 1, backgroundColor: c.ground },
      footer: {
        padding: 16,
        borderTopWidth: 1,
        borderTopColor: c.line,
        backgroundColor: c.surface,
        gap: 8,
      },
    }),
  };
}
export type JournalTheme = ReturnType<typeof journalStyles>;
export function Action({
  theme,
  children,
  onPress,
  primary = false,
  disabled = false,
  label,
  selected = false,
}: {
  theme: JournalTheme;
  children: ReactNode;
  onPress: () => void;
  primary?: boolean;
  disabled?: boolean;
  label?: string;
  selected?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled, selected }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        theme.s.button,
        primary && theme.s.primary,
        selected && theme.s.selected,
        { opacity: disabled ? 0.4 : pressed ? 0.75 : 1 },
      ]}
    >
      {typeof children === "string" ? (
        <Text style={[theme.s.buttonText, primary && theme.s.primaryText]}>{children}</Text>
      ) : (
        children
      )}
    </Pressable>
  );
}
export function JournalIcon({
  name,
  color,
  size = 22,
}: {
  name: string;
  color: string;
  size?: number;
}) {
  const paths: Record<string, string> = {
    sun: "M12 2v2m0 16v2M2 12h2m16 0h2M5 5l1.5 1.5m11 11L19 19M5 19l1.5-1.5m11-11L19 5",
    leaf: "M5 19c10 2 16-5 14-14C9 3 3 9 5 19Zm0 0L15 9",
    book: "M12 5C8 2 3 4 3 4v15s5-2 9 1c4-3 9-1 9-1V4s-5-2-9 1Zm0 0v15",
    water: "M12 2s-7 8-7 13a7 7 0 0 0 14 0c0-5-7-13-7-13Z",
    chart: "M4 20V11m8 9V4m8 16V8",
    grid: "M3 3h7v7H3Zm11 0h7v7h-7ZM3 14h7v7H3Zm11 0h7v7h-7Z",
    plus: "M12 5v14M5 12h14",
    minus: "M5 12h14",
    check: "m5 12 4 4L19 6",
    close: "m6 6 12 12M6 18 18 6",
    back: "m14 5-7 7 7 7",
    next: "m10 5 7 7-7 7",
    moon: "M20 15A9 9 0 0 1 9 4 9 9 0 1 0 20 15Z",
    skip: "M8 5v14m8-14v14",
    settings: "M12 3v3m0 12v3M3 12h3m12 0h3M5.6 5.6l2 2m8.8 8.8 2 2m-12.8 0 2-2m8.8-8.8 2-2",
  };
  return (
    <Svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth={1.6}
      strokeLinecap="round"
      strokeLinejoin="round"
      accessibilityElementsHidden
    >
      {(name === "sun" || name === "settings") && <Circle cx={12} cy={12} r={4} />}
      <Path d={paths[name] ?? paths.leaf!} />
    </Svg>
  );
}
export function Botanical({ theme }: { theme: JournalTheme }) {
  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={{ alignItems: "center", padding: 16 }}
    >
      <Svg
        width={100}
        height={90}
        viewBox="0 0 100 90"
        fill="none"
        stroke={theme.c.done}
        strokeWidth={1.3}
      >
        <Path d="M48 87c-4-28 4-53 20-73M51 63C20 65 11 46 14 29c24 0 39 14 37 34ZM56 45c0-23 16-34 37-31 0 20-16 33-37 31ZM47 85c-2-21-14-30-33-27 1 17 12 28 33 27Z" />
      </Svg>
    </View>
  );
}
