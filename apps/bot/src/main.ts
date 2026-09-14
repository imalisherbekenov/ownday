import { createServer } from "node:http";
import { webhookCallback } from "grammy";
import { PrismaClient } from "@ownday/db";
import { createServices, prismaRepositories, ReminderDeliveryQueue } from "@ownday/services";
import { createBot, prismaSessionStorage } from "./bot.js";
import { startReminderWorker } from "./worker.js";
import { publishBotSetup, type SetupApi } from "./setup.js";
// One secret, one name: the web app reads TELEGRAM_BOT_TOKEN, and BOT_TOKEN stays
// readable as a fallback so an existing local .env keeps working.
const token = process.env.TELEGRAM_BOT_TOKEN ?? process.env.BOT_TOKEN;
if (!token) throw new Error("TELEGRAM_BOT_TOKEN is required");
const webhookSecret = process.env.TELEGRAM_WEBHOOK_SECRET;
if (
  process.env.NODE_ENV === "production" &&
  (!webhookSecret || !/^[A-Za-z0-9_-]{32,256}$/.test(webhookSecret))
)
  throw new Error("TELEGRAM_WEBHOOK_SECRET must contain 32–256 URL-safe characters");
const webhookUrl = process.env.WEBHOOK_URL;
if (process.env.NODE_ENV === "production") {
  if (!webhookUrl) throw new Error("WEBHOOK_URL is required in production");
  if (new URL(webhookUrl).protocol !== "https:") throw new Error("WEBHOOK_URL must use HTTPS");
}
const db = new PrismaClient(),
  repositories = prismaRepositories(db),
  services = createServices(repositories),
  deps = { services, users: repositories.users, reminders: repositories.reminders },
  bot = createBot(token, deps, prismaSessionStorage(db));
await publishBotSetup(bot.api as unknown as SetupApi);
startReminderWorker(bot, deps, new ReminderDeliveryQueue(db));
if (process.env.NODE_ENV === "production") {
  await bot.api.setWebhook(webhookUrl!, { secret_token: webhookSecret! });
  const handler = webhookCallback(bot, "http", { secretToken: webhookSecret! });
  createServer((req, res) => {
    if (req.url === "/webhook" && req.method === "POST") void handler(req, res);
    else {
      res.statusCode = 404;
      res.end();
    }
  }).listen(Number(process.env.PORT ?? 3000));
} else await bot.start();
