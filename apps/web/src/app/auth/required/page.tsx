import Link from "next/link";
import { redirect } from "next/navigation";
import { readSession } from "@/lib/session";

export const dynamic = "force-dynamic";

export default async function AuthRequiredPage() {
  // Внутри Telegram провайдер авторизуется уже после первой отрисовки и зовёт
  // router.refresh(). Обновляется при этом текущий адрес — то есть эта самая страница.
  // Без проверки человек с готовой сессией остаётся смотреть на приглашение войти.
  if (await readSession()) redirect("/");
  const botUsername = process.env.TELEGRAM_BOT_USERNAME;
  return (
    <main className="page flex min-h-[70dvh] flex-col items-center justify-center gap-4 text-center">
      <h1 className="text-2xl font-bold">Нужен вход</h1>
      <p className="max-w-[42ch] text-ink-2">
        Ownday узнаёт вас по данным Telegram, а этот браузер их не передаёт. Откройте приложение
        через бота — там вход происходит сам.
      </p>
      <Link className="primary max-w-xs" href="/auth/login">
        Войти в веб-версию
      </Link>
      {botUsername ? (
        <Link
          className="rounded-input bg-ink px-5 py-3 text-surface active:scale-[.98]"
          href={`https://t.me/${botUsername}`}
        >
          Открыть в Telegram
        </Link>
      ) : null}
    </main>
  );
}
