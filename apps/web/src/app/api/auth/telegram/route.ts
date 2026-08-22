import { validateTelegramInitData } from "@/lib/telegram-auth";
import { services } from "@/lib/services";
import { issueSession } from "@/lib/session";
export const runtime = "nodejs";
export async function POST(request: Request) {
  try {
    const { initData, timezone = "UTC" } = (await request.json()) as {
      initData: string;
      timezone?: string;
    };
    const user = validateTelegramInitData(initData, process.env.TELEGRAM_BOT_TOKEN ?? "");
    const account = await services.ensureUserFromTelegram(String(user.id), {
      timezone,
      locale: user.language_code === "ru" ? "ru" : "en",
    });
    await issueSession(account.id);
    return Response.json({ ok: true });
  } catch {
    return Response.json({ error: "Invalid Telegram authorization" }, { status: 401 });
  }
}
