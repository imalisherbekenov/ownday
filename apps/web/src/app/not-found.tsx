"use client";
import Link from "next/link";
import { useInterfaceLocale } from "@/components/interface-locale";
export default function NotFound() {
  const { t } = useInterfaceLocale();
  return (
    <main className="page flex min-h-[70dvh] flex-col items-center justify-center gap-4 text-center">
      <h1 className="text-2xl font-bold">{t("Страница не найдена", "Page not found")}</h1>
      <p className="text-ink-2">
        {t("Проверь ссылку или вернись к своему дню.", "Check the link or return to your day.")}
      </p>
      <Link className="rounded-input bg-ink px-5 py-3 text-surface" href="/today">
        {t("К моему дню", "Back to today")}
      </Link>
    </main>
  );
}
