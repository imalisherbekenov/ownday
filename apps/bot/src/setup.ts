import { t, type Lang } from "./i18n/index.js";

type Command = { command: string; description: string };
export type SetupApi = {
  setMyCommands(
    commands: Command[],
    options: { scope: { type: "all_private_chats" }; language_code?: string },
  ): Promise<unknown>;
  setMyDescription(description: string, options: { language_code: string }): Promise<unknown>;
  setMyShortDescription(description: string, options: { language_code: string }): Promise<unknown>;
  setChatMenuButton(options: {
    menu_button: { type: "commands" } | { type: "web_app"; text: string; web_app: { url: string } };
  }): Promise<unknown>;
};

const commands = (lang: Lang): Command[] =>
  (["today", "new", "habits", "stats", "settings", "help"] as const).map((command) => ({
    command,
    description: t(lang, `command_${command}`),
  }));

export async function publishBotSetup(api: SetupApi) {
  const scope = { type: "all_private_chats" as const };
  await api.setMyCommands(commands("ru"), { scope, language_code: "ru" });
  await api.setMyCommands(commands("en"), { scope, language_code: "en" });
  await api.setMyCommands(commands("en"), { scope });
  await api.setMyDescription(t("ru", "description"), { language_code: "ru" });
  await api.setMyDescription(t("en", "description"), { language_code: "en" });
  await api.setMyShortDescription(t("ru", "shortDescription"), { language_code: "ru" });
  await api.setMyShortDescription(t("en", "shortDescription"), { language_code: "en" });
  const appUrl = process.env.APP_URL;
  let secureAppUrl: string | undefined;
  if (appUrl) {
    try {
      const url = new URL(appUrl);
      if (url.protocol === "https:") secureAppUrl = appUrl;
    } catch {
      // Invalid APP_URL is treated the same as an unset APP_URL.
    }
  }
  await api.setChatMenuButton({
    menu_button: secureAppUrl
      ? { type: "web_app", text: t("en", "openApp"), web_app: { url: secureAppUrl } }
      : { type: "commands" },
  });
}
