export type SeedTemplate = {
  id: string;
  title: string;
  icon: string;
  category: string;
  defaultSchedule: { kind: "daily" } | { kind: "days_of_week"; days: number[] };
  defaultType: "binary" | "counter" | "duration";
  locale: "ru" | "en";
};
const ru = [
  ["Выпить воду", "droplet", "здоровье", "counter"],
  ["Принять витамины", "pill", "здоровье", "binary"],
  ["Утренняя зарядка", "activity", "спорт", "duration"],
  ["Пробежка", "footprints", "спорт", "duration"],
  ["Лечь до полуночи", "moon", "сон", "binary"],
  ["Без экрана перед сном", "smartphone", "сон", "duration"],
  ["Овощи каждый день", "salad", "питание", "binary"],
  ["Записать питание", "notebook", "питание", "binary"],
  ["Медитация", "sun", "ум", "duration"],
  ["Дневник", "pen-line", "ум", "binary"],
  ["Читать 20 страниц", "book", "учёба", "counter"],
  ["Учить новые слова", "languages", "учёба", "counter"],
  ["Записать расходы", "wallet", "финансы", "binary"],
  ["День без покупок", "badge-dollar-sign", "финансы", "binary"],
  ["Порядок на столе", "sparkles", "дом", "binary"],
  ["Разобрать одну полку", "archive", "дом", "binary"],
  ["Позвонить близким", "phone", "общение", "binary"],
  ["Написать другу", "message-circle", "общение", "binary"],
  ["Рисовать", "palette", "творчество", "duration"],
  ["Играть на инструменте", "music", "творчество", "duration"],
] as const;
const en = [
  ["Drink water", "droplet", "health", "counter"],
  ["Take vitamins", "pill", "health", "binary"],
  ["Morning mobility", "activity", "fitness", "duration"],
  ["Go for a run", "footprints", "fitness", "duration"],
  ["Sleep before midnight", "moon", "sleep", "binary"],
  ["Screen-free wind-down", "smartphone", "sleep", "duration"],
  ["Eat vegetables", "salad", "nutrition", "binary"],
  ["Log meals", "notebook", "nutrition", "binary"],
  ["Meditate", "sun", "mind", "duration"],
  ["Write a journal", "pen-line", "mind", "binary"],
  ["Read twenty pages", "book", "learning", "counter"],
  ["Learn new words", "languages", "learning", "counter"],
  ["Track spending", "wallet", "finance", "binary"],
  ["No-spend day", "badge-dollar-sign", "finance", "binary"],
  ["Clear the desk", "sparkles", "home", "binary"],
  ["Tidy one shelf", "archive", "home", "binary"],
  ["Call family", "phone", "social", "binary"],
  ["Message a friend", "message-circle", "social", "binary"],
  ["Sketch", "palette", "creativity", "duration"],
  ["Practice an instrument", "music", "creativity", "duration"],
] as const;
const make = (
  rows: readonly (readonly [string, string, string, "binary" | "counter" | "duration"])[],
  locale: "ru" | "en",
): SeedTemplate[] =>
  rows.map((r, i) => ({
    id: `${locale}-${i + 1}`,
    title: r[0],
    icon: r[1],
    category: r[2],
    defaultType: r[3],
    locale,
    defaultSchedule: i % 4 === 3 ? { kind: "days_of_week", days: [1, 3, 5] } : { kind: "daily" },
  }));
export const habitTemplates = [...make(ru, "ru"), ...make(en, "en")];
