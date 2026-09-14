import { notFound } from "next/navigation";
import { getCurrentUserId } from "@/lib/services";
import { journalService } from "@/lib/journal-service";
import { JournalHabitEditor } from "@/components/journal-habit-editor";
export default async function EditHabitPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const snapshot = await journalService().snapshot(await getCurrentUserId());
  const initial = snapshot.habits.find((h) => h.id === id);
  if (!initial) notFound();
  return <JournalHabitEditor key={snapshot.userId + id} snapshot={snapshot} initial={initial} />;
}
