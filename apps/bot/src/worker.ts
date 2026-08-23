import type { Bot } from "grammy";
import type { HandlerDeps } from "./handlers.js";
import { t } from "./i18n/index.js";
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
export async function sendWithRetry(
  bot: Bot<any>,
  chatId: string,
  text: string,
  reply_markup: any,
) {
  for (let n = 0; n < 3; n++)
    try {
      return await bot.api.sendMessage(chatId, text, { reply_markup });
    } catch (e: any) {
      const retry = e?.error?.parameters?.retry_after ?? e?.parameters?.retry_after;
      if (!retry || n === 2) throw e;
      await sleep(retry * 1000);
    }
}
export function startReminderWorker(bot: Bot<any>, d: HandlerDeps) {
  let running = false;
  const tick = async () => {
    if (running) return;
    running = true;
    const now = new Date();
    try {
      for (const r of await d.services.dueReminders(now, 100))
        try {
          const u = await d.users.findById(r.userId),
            identity = await d.users.findIdentityForUser(r.userId, "telegram"),
            rows = r.habitId ? await d.services.listHabitsForToday(r.userId, now) : [];
          if (!u || !identity) continue;
          const row = rows.find((x) => x.habit.id === r.habitId);
          if (!row) {
            await d.services.advanceReminder(r.id, now);
            continue;
          }
          const title = row.habit.title;
          await sendWithRetry(bot, identity.externalId, t(u.locale, "reminder", { title }), {
            inline_keyboard: row
              ? [
                  [
                    {
                      text: t(u.locale, "done"),
                      callback_data: `m:${row.habit.id}:${row.localDate}:d`,
                    },
                    {
                      text: t(u.locale, "skip"),
                      callback_data: `m:${row.habit.id}:${row.localDate}:s`,
                    },
                  ],
                  [{ text: "+1h", callback_data: `s:${r.id}` }],
                ]
              : [],
          });
          await d.services.advanceReminder(r.id, now);
        } catch (e) {
          console.error("reminder failed", r.id, e);
        }
    } finally {
      running = false;
    }
  };
  void tick();
  const timer = setInterval(() => void tick(), 60_000);
  return () => clearInterval(timer);
}
