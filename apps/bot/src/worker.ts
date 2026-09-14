import type { Bot } from "grammy";
import { localDateFor } from "@ownday/core";
import type { ReminderDeliveryQueue } from "@ownday/services";
import type { HandlerDeps } from "./handlers.js";
import { t } from "./i18n/index.js";

export async function deliverOne(
  bot: Bot<any>,
  d: HandlerDeps,
  queue: ReminderDeliveryQueue,
  now = new Date(),
) {
  const job = await queue.claim(now);
  if (!job) return false;
  const r = job.reminder,
    token = job.leaseToken!;
  try {
    const today = localDateFor(now, r.user.timezone, r.user.dayStartHour);
    const identity = await d.users.findIdentityForUser(r.userId, "telegram");
    const rows = r.habitId ? await d.services.listHabitsForToday(r.userId, now) : [];
    const row = rows.find((item) => item.habit.id === r.habitId);
    if (
      !r.enabled ||
      !identity ||
      !row ||
      job.localDate !== today ||
      row.entry?.status === "done" ||
      row.entry?.status === "skip"
    ) {
      await queue.complete(job.id, token, "skipped", new Date());
      return true;
    }
    const controller = new AbortController(),
      timeout = setTimeout(() => controller.abort(), 30000);
    try {
      await bot.api.sendMessage(
        identity.externalId,
        t(r.user.locale === "ru" ? "ru" : "en", "reminder", { title: row.habit.title }),
        {
          reply_markup: {
            inline_keyboard: [
              [
                {
                  text: t(r.user.locale === "ru" ? "ru" : "en", "done"),
                  callback_data: `m:${row.habit.id}:${row.localDate}:d`,
                },
                {
                  text: t(r.user.locale === "ru" ? "ru" : "en", "skip"),
                  callback_data: `m:${row.habit.id}:${row.localDate}:s`,
                },
              ],
              [{ text: "+1h", callback_data: `s:${r.id}` }],
            ],
          },
        },
        controller.signal as Parameters<typeof bot.api.sendMessage>[3],
      );
    } finally {
      clearTimeout(timeout);
    }
    await queue.complete(job.id, token, "sent", new Date());
  } catch (error) {
    const cause = error as { error_code?: number; parameters?: { retry_after?: number } };
    const code = Number.isInteger(cause.error_code)
      ? `TELEGRAM_${cause.error_code}`
      : "DELIVERY_UNCONFIRMED";
    await queue.fail(
      job.id,
      token,
      new Date(),
      code,
      cause.parameters?.retry_after,
      [400, 403, 404].includes(cause.error_code ?? 0),
    );
    console.error("reminder delivery deferred", job.id, code);
  }
  return true;
}
export function startReminderWorker(bot: Bot<any>, d: HandlerDeps, queue: ReminderDeliveryQueue) {
  let running = false,
    stopped = false;
  const tick = async () => {
    if (running || stopped) return;
    running = true;
    try {
      await queue.prepare(new Date());
      for (let count = 0; count < 30 && !stopped; count++)
        if (!(await deliverOne(bot, d, queue))) break;
    } catch {
      console.error("reminder queue iteration failed");
    } finally {
      running = false;
    }
  };
  void tick();
  const timer = setInterval(() => {
    void tick();
  }, 15000);
  return () => {
    stopped = true;
    clearInterval(timer);
  };
}
