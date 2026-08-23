import Link from "next/link";
import { TemplateCatalog } from "@/components/template-catalog";
import { getCurrentUserId, services } from "@/lib/services";
import { addTemplateAction } from "./actions";
export const dynamic = "force-dynamic";
export default async function TemplatesPage() {
  const userId = await getCurrentUserId(),
    user = await services.getUser(userId);
  const templates = await services.listTemplates(user?.locale ?? "ru");
  return (
    <main className="page py-6">
      <header className="app-header mb-6">
        <p className="label">Быстрый старт</p>
        <h1 className="text-[32px] font-extrabold tracking-[-.03em]">Шаблоны</h1>
        <p className="mt-2 text-ink-3">Добавьте готовую привычку одним нажатием.</p>
      </header>
      <TemplateCatalog templates={templates} onAdd={addTemplateAction} />
      <Link href="/habits/new" className="primary mt-6 flex items-center justify-center">
        Создать свою
      </Link>
    </main>
  );
}
