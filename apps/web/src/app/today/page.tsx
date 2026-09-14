import { getCurrentUserId } from "@/lib/services";
import { journalService } from "@/lib/journal-service";
import { JournalDay } from "@/components/journal-day";
import { assertLocalDate, localDateFor } from "@ownday/core";
export const dynamic = "force-dynamic";
export default async function TodayPage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string }>;
}) {
  const initial = await journalService().snapshot(await getCurrentUserId());
  let date =
    (await searchParams).date ??
    localDateFor(new Date(), initial.preferences.timezone, initial.preferences.dayStartHour);
  try {
    assertLocalDate(date);
  } catch {
    date = localDateFor(new Date(), initial.preferences.timezone, initial.preferences.dayStartHour);
  }
  return <JournalDay key={initial.userId} initial={initial} initialDate={date} />;
}
