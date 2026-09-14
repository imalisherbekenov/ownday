import { getCurrentUserId, services } from "@/lib/services";
import { journalService } from "@/lib/journal-service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Кнопка «Экспорт» раньше звала серверное действие, которое считало сводку и
// выбрасывало её: человек нажимал и не получал ничего. Отдать файл серверное
// действие и не может — это умеет только ответ с Content-Disposition, то есть
// маршрут. Отдаётся всё: привычки вместе с версиями расписания и все отметки,
// а не срез за год, потому что «мои данные» — это мои данные.
export async function GET() {
  const userId = await getCurrentUserId();
  const today = await services.localDateForUser(userId, new Date());
  const [habits, entries] = await Promise.all([
    services.listHabits(userId, true),
    services.listEntriesForUser(userId, "1970-01-01", today),
  ]);
  const operations = process.env.DATABASE_URL
    ? await journalService().operationHistory(userId)
    : undefined;
  const body = JSON.stringify({ exportedOn: today, habits, entries, operations }, null, 2);
  return new Response(body, {
    headers: {
      "content-type": "application/json; charset=utf-8",
      "content-disposition": `attachment; filename="ownday-${today}.json"`,
      // Выгрузка — это весь дневник целиком, и лежать в общих кэшах ей незачем.
      "cache-control": "no-store",
    },
  });
}
