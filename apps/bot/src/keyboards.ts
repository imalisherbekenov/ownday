import { t, type Lang } from "./i18n/index.js";

export type InlineButton =
  | { text: string; callback_data: string }
  | { text: string; url: string }
  | { text: string; web_app: { url: string } };

export type InlineKeyboard = { inline_keyboard: InlineButton[][] };

type ReplyButton = { text: string } | Extract<InlineButton, { web_app: { url: string } }>;

export type ReplyKeyboard = {
  keyboard: ReplyButton[][];
  resize_keyboard: true;
  is_persistent: true;
  input_field_placeholder?: string;
};

const secureAppUrl = (appUrl?: string) => {
  if (!appUrl) return undefined;
  try {
    return new URL(appUrl).protocol === "https:" ? appUrl : undefined;
  } catch {
    return undefined;
  }
};

export const mainMenu = (lang: Lang, appUrl = process.env.APP_URL): ReplyKeyboard => {
  const url = secureAppUrl(appUrl);
  return {
    keyboard: [
      [{ text: t(lang, "menuToday") }, { text: t(lang, "menuNew") }],
      [{ text: t(lang, "menuHabits") }, { text: t(lang, "menuStats") }],
      [{ text: t(lang, "menuSettings") }],
      ...(url ? [[{ text: t(lang, "openApp"), web_app: { url } }]] : []),
    ],
    resize_keyboard: true,
    is_persistent: true,
    input_field_placeholder: t(lang, "menuPlaceholder"),
  };
};

export const todayKeyboard = (
  lang: Lang,
  rows: Array<{
    habit: { id: string; type: string };
    localDate: string;
    entry?: { status: string; value?: number } | null;
  }>,
): InlineKeyboard => ({
  inline_keyboard: rows.map(({ habit, localDate, entry }) => {
    const prefix = `m:${habit.id}:${localDate}:`;
    if (entry?.status === "done") {
      return [{ text: t(lang, "undo"), callback_data: `u:${habit.id}:${localDate}` }];
    }
    return habit.type === "binary"
      ? [
          { text: t(lang, "done"), callback_data: `${prefix}d` },
          { text: t(lang, "skip"), callback_data: `${prefix}s` },
        ]
      : [
          { text: t(lang, "minus"), callback_data: `${prefix}-` },
          { text: t(lang, "plus"), callback_data: `${prefix}+` },
          { text: t(lang, "skip"), callback_data: `${prefix}s` },
        ];
  }),
});

export const backTo = (lang: Lang, target: "today" | "habits" | "menu"): InlineKeyboard => ({
  inline_keyboard: [
    [
      {
        text: t(
          lang,
          target === "today" ? "menuToday" : target === "habits" ? "menuHabits" : "backMenu",
        ),
        callback_data: `go:${target}`,
      },
    ],
  ],
});
