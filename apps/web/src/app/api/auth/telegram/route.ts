import { validateTelegramInitData, type TelegramUser } from "@/lib/telegram-auth";
import { services } from "@/lib/services";
import { issueSession } from "@/lib/session";
export const runtime = "nodejs";
export async function POST(request: Request) {
  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  if (!botToken) {
    return Response.json({ error: "Telegram authorization is not configured" }, { status: 500 });
  }
  let user: TelegramUser;
  let timezone = "UTC";
  try {
    const body = (await request.json()) as { initData: string; timezone?: string };
    timezone = body.timezone ?? "UTC";
    user = validateTelegramInitData(body.initData, botToken);
  } catch {
    return Response.json({ error: "Invalid Telegram authorization" }, { status: 401 });
  }
  try {
    const account = await services.ensureUserFromTelegram(String(user.id), {
      timezone,
      locale: user.language_code === "ru" ? "ru" : "en",
    });
    await issueSession(account.id);
    return Response.json({ ok: true });
  } catch (cause) {
    // Один catch на весь роут отвечал «Invalid Telegram authorization» и на недоступную
    // базу тоже: подпись сходилась, падал Postgres, а человек читал, что виноваты его
    // данные. Причём не оставалось и следа — эта ветка молчала. Теперь подпись отвечает
    // за 401, всё после неё — за 500, и причина уходит в лог.
    console.error("telegram auth: signature valid, session not issued", cause);
    return Response.json({ error: "Telegram authorization failed" }, { status: 500 });
  }
}
