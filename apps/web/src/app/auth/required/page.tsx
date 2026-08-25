import Link from "next/link";

export const dynamic = "force-dynamic";

export default function AuthRequiredPage() {
  const botUsername = process.env.TELEGRAM_BOT_USERNAME;
  return (
    <main className="page flex min-h-[70dvh] flex-col items-center justify-center gap-4 text-center">
      <h1 className="text-2xl font-bold">Нужен вход</h1>
      <p className="max-w-[42ch] text-ink-2">
        Ownday узнаёт вас по данным Telegram, а этот браузер их не передаёт. Откройте приложение
        через бота — там вход происходит сам.
      </p>
      {botUsername ? (
        <Link
          className="rounded-input bg-ink px-5 py-3 text-surface active:scale-[.98]"
          href={`https://t.me/${botUsername}`}
        >
          Открыть в Telegram
        </Link>
      ) : null}
      <p className="max-w-[42ch] text-caption text-ink-3">
        Вход по ссылке на почту ещё не подключён.
      </p>
    </main>
  );
}
