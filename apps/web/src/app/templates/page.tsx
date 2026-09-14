import Link from "next/link";
import { TemplateCatalog } from "@/components/template-catalog";
import { getCurrentUserId, services } from "@/lib/services";
import { interfaceLocale } from "@/lib/interface-locale";
export const dynamic = "force-dynamic";
export default async function TemplatesPage() {
  await getCurrentUserId();
  const locale = await interfaceLocale(),
    t = (ru: string, en: string) => (locale === "ru" ? ru : en);
  const templates = await services.listTemplates(locale);
  return (
    <main className="page py-6">
      <header className="app-header journal-heading mb-6">
        <p className="label">{t("Быстрый старт", "A little inspiration")}</p>
        <h1>{t("С чего начнём?", "Where shall we start?")}</h1>
        <p className="mt-2 text-ink-3">
          {t("Выбери привычку, которая подходит твоему дню.", "Choose a habit that fits your day.")}
        </p>
      </header>
      <TemplateCatalog templates={templates} />
      <Link href="/habits/new" className="primary mt-6 flex items-center justify-center">
        {t("Создать свою", "Create my own")}
      </Link>
    </main>
  );
}
