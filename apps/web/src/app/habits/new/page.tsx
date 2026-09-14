import { getCurrentUserId, services } from "@/lib/services";
import { interfaceLocale } from "@/lib/interface-locale";
import { journalService } from "@/lib/journal-service";
import { JournalHabitEditor } from "@/components/journal-habit-editor";
export default async function NewHabitPage({
  searchParams,
}: {
  searchParams: Promise<{ template?: string }>;
}) {
  const snapshot = await journalService().snapshot(await getCurrentUserId());
  const { template: id } = await searchParams;
  const template = id
    ? (await services.listTemplates(await interfaceLocale())).find((t) => t.id === id)
    : undefined;
  return (
    <JournalHabitEditor
      key={`${snapshot.userId}:${id ?? "new"}`}
      snapshot={snapshot}
      template={template}
    />
  );
}
