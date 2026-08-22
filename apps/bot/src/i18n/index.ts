import { ru } from "./ru.js";
import { en } from "./en.js";
export type Lang = "ru" | "en";
const dictionaries = { ru, en };
export const t = (lang: Lang, key: keyof typeof en, vars: Record<string, string | number> = {}) =>
  Object.entries(vars).reduce(
    (s, [k, v]) => s.replace(`{${k}}`, String(v)),
    dictionaries[lang][key] as string,
  );
