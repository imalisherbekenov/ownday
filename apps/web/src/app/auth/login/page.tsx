import { redirect } from "next/navigation";
import { readSession } from "@/lib/session";
import { GoogleButton } from "./google-button";
import { LoginForm } from "./login-form";
import { interfaceLocale } from "@/lib/interface-locale";
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
  const locale = await interfaceLocale(),
    t = (ru: string, en: string) => (locale === "ru" ? ru : en);
  if (await readSession()) redirect("/today");
  const { error } = await searchParams;
  const english: Record<string, string> = {
    link: "This sign-in link has expired. Request a new one.",
    state: "Sign-in took too long. Please try again.",
    google: "Could not sign in with Google. Please try again.",
  };
  const notice = error ? (locale === "en" ? english : reasons)[error] : undefined;
  // Без ключа Resend письмо уходит в консоль сервера, а человек читает «проверьте
  // почту» и ждёт того, чего не будет. Обещать вход, которого нет, хуже, чем его не
  // предлагать. В разработке консоль и есть доставка, поэтому форма остаётся.
  const emailSignIn = Boolean(process.env.RESEND_API_KEY) || process.env.NODE_ENV !== "production";
  return (
    <main className="page flex min-h-[70dvh] items-center justify-center">
      <section className="card flex w-full max-w-md flex-col gap-5 p-6">
        <div>
          <h1 className="text-2xl font-bold">{t("Войти в Ownday", "Welcome to Ownday")}</h1>
          <p className="mt-2 text-ink-2">
            {emailSignIn
              ? t(
                  "Продолжи с Google или получи ссылку на почту.",
                  "Continue with Google or get an email sign-in link.",
                )
              : t("Продолжи с Google.", "Continue with Google.")}
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
