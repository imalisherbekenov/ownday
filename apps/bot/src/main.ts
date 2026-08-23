import { createServer } from "node:http";
import { webhookCallback } from "grammy";
import { PrismaClient } from "@ownday/db";
import { createServices, prismaRepositories } from "@ownday/services";
import { createBot, prismaSessionStorage } from "./bot.js";
import { startReminderWorker } from "./worker.js";
import { publishBotSetup, type SetupApi } from "./setup.js";
// One secret, one name: the web app reads TELEGRAM_BOT_TOKEN, and BOT_TOKEN stays
// readable as a fallback so an existing local .env keeps working.
const token = process.env.TELEGRAM_BOT_TOKEN ?? process.env.BOT_TOKEN;
if (!token) throw new Error("TELEGRAM_BOT_TOKEN is required");
const db = new PrismaClient(),
  repositories = prismaRepositories(db),
  services = createServices(repositories),
  deps = { services, users: repositories.users, reminders: repositories.reminders },
  bot = createBot(token, deps, prismaSessionStorage(db));
await publishBotSetup(bot.api as unknown as SetupApi);
startReminderWorker(bot, deps);
if (process.env.NODE_ENV === "production") {
  const url = process.env.WEBHOOK_URL;
  if (!url) throw new Error("WEBHOOK_URL is required in production");
  await bot.api.setWebhook(url);
  const handler = webhookCallback(bot, "http");
  createServer((req, res) => {
    if (req.url === "/webhook" && req.method === "POST") void handler(req, res);
    else {
      res.statusCode = 404;
      res.end();
    }
  }).listen(Number(process.env.PORT ?? 3000));
} else await bot.start();
