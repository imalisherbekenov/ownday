import Link from "next/link";
import { redirect } from "next/navigation";
import { readSession } from "@/lib/session";
import { interfaceLocale } from "@/lib/interface-locale";

export const dynamic = "force-dynamic";

export default async function AuthRequiredPage() {
  // Внутри Telegram провайдер авторизуется уже после первой отрисовки и зовёт
  // router.refresh(). Обновляется при этом текущий адрес — то есть эта самая страница.
  // Без проверки человек с готовой сессией остаётся смотреть на приглашение войти.
  if (await readSession()) redirect("/today");
  const locale = await interfaceLocale(),
    t = (ru: string, en: string) => (locale === "ru" ? ru : en);
  const botUsername = process.env.TELEGRAM_BOT_USERNAME;
  return (
    <main className="page flex min-h-[70dvh] flex-col items-center justify-center gap-4 text-center">
      <h1 className="text-3xl font-bold">{t("Твой день — с тобой", "Your day, with you")}</h1>
      <p className="max-w-[42ch] text-ink-2">
        {t(
          "Войди, чтобы открыть привычки и историю в браузере. В мобильном приложении можно начать без аккаунта.",
          "Sign in to open your habits and history in the browser. You can start without an account in the mobile app.",
        )}
      </p>
      <Link className="primary max-w-xs" href="/auth/login">
        {t("Войти в веб-версию", "Sign in to the web app")}
      </Link>
      <Link className="inline-flex min-h-11 items-center underline underline-offset-4" href="/">
        {t("Познакомиться с Ownday", "Discover Ownday")}
      </Link>
      {botUsername ? (
        <Link
          className="rounded-input bg-ink px-5 py-3 text-surface active:scale-[.98]"
          href={`https://t.me/${botUsername}`}
        >
          {t("Открыть в Telegram", "Open in Telegram")}
        </Link>
      ) : null}
    </main>
  );
}
