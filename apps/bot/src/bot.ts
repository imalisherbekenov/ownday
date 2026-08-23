import { Bot, session } from "grammy";
import type { Context, SessionFlavor, StorageAdapter } from "grammy";
import type { PrismaClient } from "@ownday/db";
import type { HandlerDeps } from "./handlers.js";
import {
  callback,
  help,
  habits,
  newHabit,
  settings,
  start,
  stats,
  text,
  today,
  type Session,
} from "./handlers.js";
import { t } from "./i18n/index.js";
export function prismaSessionStorage(db: PrismaClient): StorageAdapter<Session> {
  return {
    async read(key) {
      const x = await db.botSession.findUnique({ where: { key } });
      return x?.data as Session | undefined;
    },
    async write(key, value) {
      const create: any = { key, data: value },
        update: any = { data: value };
      if (value.userId) {
        create.userId = value.userId;
        update.userId = value.userId;
      }
      await db.botSession.upsert({ where: { key }, create, update });
    },
    async delete(key) {
      await db.botSession.deleteMany({ where: { key } });
    },
  };
}
export function createBot(token: string, deps: HandlerDeps, storage: StorageAdapter<Session>) {
  const bot = new Bot<Context & SessionFlavor<Session>>(token);
  bot.use(session({ initial: (): Session => ({ lang: "ru" }), storage }));
  bot.command("start", (ctx) => start(ctx as any, deps));
  bot.command("today", (ctx) => today(ctx as any, deps));
  bot.command("new", (ctx) => newHabit(ctx as any, deps));
  bot.command("habits", (ctx) => habits(ctx as any, deps));
  bot.command("stats", (ctx) => stats(ctx as any, deps));
  bot.command("settings", (ctx) => settings(ctx as any, deps));
  bot.command("help", (ctx) => help(ctx as any, deps));
  bot.on("callback_query:data", (ctx) => callback(ctx as any, deps));
  bot.on("message:text", (ctx) => text(ctx as any, deps));
  bot.catch(async (e) => {
    console.error("bot update failed", e.error);
    try {
      let lang: "ru" | "en" = "ru";
      try {
        lang = e.ctx.session?.lang ?? "ru";
      } catch {}
      await e.ctx.reply(t(lang, "error"), {
        reply_markup: {
          inline_keyboard: [
            [
              { text: t(lang, "retry"), callback_data: "go:menu" },
              { text: t(lang, "menuToday"), callback_data: "go:today" },
            ],
          ],
        },
      });
    } catch {}
  });
  return bot;
}
