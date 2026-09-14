import { notFound } from "next/navigation";
import { localDateFor } from "@ownday/core";
import { getCurrentUserId } from "@/lib/services";
import { journalService } from "@/lib/journal-service";
import { JournalDay } from "@/components/journal-day";
export const dynamic = "force-dynamic";
export default async function HabitDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const snapshot = await journalService().snapshot(await getCurrentUserId());
  if (!snapshot.habits.some((h) => h.id === id)) notFound();
  const today = localDateFor(
    new Date(),
    snapshot.preferences.timezone,
    snapshot.preferences.dayStartHour,
  );
  return (
    <JournalDay
      key={`${snapshot.userId}:${id}`}
      initial={snapshot}
      initialDate={today}
      habitId={id}
    />
  );
}
