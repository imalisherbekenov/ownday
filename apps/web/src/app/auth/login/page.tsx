import { redirect } from "next/navigation";
import { readSession } from "@/lib/session";
import { GoogleButton } from "./google-button";
import { LoginForm } from "./login-form";
export const dynamic = "force-dynamic";
export default async function LoginPage() {
  if (await readSession()) redirect("/");
  return (
    <main className="page flex min-h-[70dvh] items-center justify-center">
      <section className="card flex w-full max-w-md flex-col gap-5 p-6">
        <div>
          <h1 className="text-2xl font-bold">Войти в Ownday</h1>
          <p className="mt-2 text-ink-2">Продолжите с Google или получите ссылку на почту.</p>
        </div>
        <GoogleButton />
        <div className="border-t border-line" />
        <LoginForm />
      </section>
    </main>
  );
}
