import "server-only";
import { redirect } from "next/navigation";
import { localDateFor } from "@ownday/core";
import {
  createServices,
  InMemoryEntryRepository,
  InMemoryHabitRepository,
  InMemoryReminderRepository,
  InMemoryUserRepository,
  InMemoryTemplateRepository,
  type ServiceDependencies,
  prismaRepositories,
} from "@ownday/services";
import { PrismaClient } from "@ownday/db";
type Store = ServiceDependencies & { ready?: Promise<string> };
const globalStore = globalThis as typeof globalThis & {
  __owndayWebStore?: Store;
  __owndayPrisma?: PrismaClient;
};
function createStore(): Store {
  if (process.env.DATABASE_URL) {
    const prisma = (globalStore.__owndayPrisma ??= new PrismaClient());
    return prismaRepositories(prisma);
  }
  return {
    habits: new InMemoryHabitRepository(),
    entries: new InMemoryEntryRepository(),
    users: new InMemoryUserRepository(),
    reminders: new InMemoryReminderRepository(),
    templates: new InMemoryTemplateRepository(),
  };
}
export const repositories = (globalStore.__owndayWebStore ??= createStore());
export const services = createServices(repositories);
export function ensureDemoData() {
  return (repositories.ready ??= (async () => {
    const existing = await repositories.users.findIdentity("email", "demo@ownday.local");
    if (existing) return existing.user.id;
    const user = await repositories.users.createWithIdentity({
      provider: "email",
      externalId: "demo@ownday.local",
      timezone: "Asia/Tashkent",
      dayStartHour: 4,
      locale: "en",
    });
    const today = localDateFor(new Date(), user.timezone, user.dayStartHour);
    const habits = await Promise.all([
      services.createHabit({
        userId: user.id,
        title: "Morning meditation",
        type: "binary",
        icon: "sun",
        color: "moss",
        schedule: { kind: "daily" },
        validFrom: "2025-01-01",
      }),
      services.createHabit({
        userId: user.id,
        title: "Read twenty pages daily",
        type: "counter",
        icon: "book",
        color: "ocean",
        targetValue: 20,
        unit: "pages",
        schedule: { kind: "daily" },
        validFrom: "2025-01-01",
      }),
      services.createHabit({
        userId: user.id,
        title: "Deep work",
        type: "duration",
        icon: "timer",
        color: "indigo",
        targetValue: 45,
        unit: "min",
        schedule: { kind: "days_of_week", days: [1, 2, 3, 4, 5] },
        validFrom: "2025-01-01",
      }),
    ]);
    await services.markEntry({
      userId: user.id,
      habitId: habits[0]!.id,
      localDate: today,
      status: "done",
      source: "web",
      clientId: crypto.randomUUID(),
    });
    await services.setEntryValue({
      userId: user.id,
      habitId: habits[1]!.id,
      localDate: today,
      value: 12,
      source: "web",
    });
    return user.id;
  })());
}
export async function getCurrentUserId() {
  const { readSession } = await import("./session");
  const sessionUserId = await readSession();
  if (sessionUserId) return sessionUserId;
  // Отказ в доступе — не сбой, и показывать его как сбой нельзя. В production Next
  // вырезает текст ошибки из клиентской границы: до error.tsx доезжает один digest,
  // отличить «не пущен» от «сломалось» там нечем. Человек видел бы «Something went
  // wrong» и кнопку «Try again», которая не может помочь никогда.
  if (process.env.NODE_ENV === "production") redirect("/auth/required");
  return ensureDemoData();
}
