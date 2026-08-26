import { redirect } from "next/navigation";
import { readSession } from "@/lib/session";
import { GoogleButton } from "./google-button";
import { LoginForm } from "./login-form";
export const dynamic = "force-dynamic";

// Сюда возвращаются все неудачи входа: протухшая ссылка из письма, устаревшая
// страница входа, отказ Google. Причина едет параметром, а не текстом, чтобы адрес
// не превращался в способ показать человеку любую надпись от нашего имени.
const reasons: Record<string, string> = {
  link: "Ссылка для входа больше не действует. Запросите новую.",
  state: "Вход занял слишком много времени. Попробуйте ещё раз.",
  google: "Не получилось войти через Google. Попробуйте ещё раз.",
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  if (await readSession()) redirect("/");
  const { error } = await searchParams;
  const notice = error ? reasons[error] : undefined;
  // Без ключа Resend письмо уходит в консоль сервера, а человек читает «проверьте
  // почту» и ждёт того, чего не будет. Обещать вход, которого нет, хуже, чем его не
  // предлагать. В разработке консоль и есть доставка, поэтому форма остаётся.
  const emailSignIn = Boolean(process.env.RESEND_API_KEY) || process.env.NODE_ENV !== "production";
  return (
    <main className="page flex min-h-[70dvh] items-center justify-center">
      <section className="card flex w-full max-w-md flex-col gap-5 p-6">
        <div>
          <h1 className="text-2xl font-bold">Войти в Ownday</h1>
          <p className="mt-2 text-ink-2">
            {emailSignIn
              ? "Продолжите с Google или получите ссылку на почту."
              : "Продолжите с Google."}
          </p>
        </div>
        {notice ? (
          <p className="rounded-input bg-miss-soft px-4 py-3 text-sm text-miss" role="alert">
            {notice}
          </p>
        ) : null}
        <GoogleButton />
        {emailSignIn ? (
          <>
            <div className="border-t border-line" />
            <LoginForm />
          </>
        ) : null}
      </section>
    </main>
  );
}
