import { afterAll, describe, it, expect } from "vitest";
import { PrismaClient } from "@ownday/db";
import { ReminderDeliveryQueue } from "./reminder-delivery.js";
const url = process.env.TEST_DATABASE_URL;
if (url) {
  const target = new URL(url);
  if (
    !["localhost", "127.0.0.1", "[::1]"].includes(target.hostname) ||
    !target.pathname.startsWith("/ownday_test")
  )
    throw new Error("Dedicated local test database required");
}
const db = url ? new PrismaClient({ datasources: { db: { url } } }) : null,
  users: string[] = [];
const now = new Date("2026-09-13T12:00:00Z");
async function setup() {
  const user = await db!.user.create({ data: { timezone: "UTC", locale: "ru" } });
  users.push(user.id);
  const reminder = await db!.reminder.create({
    data: {
      userId: user.id,
      localTime: new Date("1970-01-01T12:00:00Z"),
      daysMask: 127,
      channel: "tg",
      nextFireAt: now,
    },
  });
  return { reminder, queue: new ReminderDeliveryQueue(db!) };
}
describe.skipIf(!db)("durable reminder delivery", () => {
  it("creates one occurrence and lets only one concurrent worker claim it", async () => {
    const { reminder, queue } = await setup();
    await Promise.all([queue.prepare(now), queue.prepare(now)]);
    expect(await db!.reminderDelivery.count({ where: { reminderId: reminder.id } })).toBe(1);
    const results = await Promise.all([queue.claim(now), queue.claim(now)]),
      job = results.find(Boolean)!;
    expect(results.filter(Boolean)).toHaveLength(1);
    expect(job.reminderId).toBe(reminder.id);
    expect(await queue.complete(job.id, job.leaseToken!, "sent", now)).toBe(true);
    expect(await queue.claim(now)).toBeNull();
  });
  it("recovers an expired lease and rejects acknowledgement from its previous owner", async () => {
    const { queue } = await setup();
    await queue.prepare(now);
    const first = (await queue.claim(now))!,
      later = new Date(now.getTime() + 91000),
      second = (await queue.claim(later))!;
    expect(second.id).toBe(first.id);
    expect(second.leaseToken).not.toBe(first.leaseToken);
    expect(await queue.complete(first.id, first.leaseToken!, "sent", later)).toBe(false);
    await queue.complete(second.id, second.leaseToken!, "skipped", later);
  });
  it("persists Telegram retry timing instead of sleeping with a leased job", async () => {
    const { queue } = await setup();
    await queue.prepare(now);
    const first = (await queue.claim(now))!;
    await queue.fail(first.id, first.leaseToken!, now, "TELEGRAM_429", 120);
    expect(await queue.claim(new Date(now.getTime() + 119000))).toBeNull();
    const retry = (await queue.claim(new Date(now.getTime() + 120000)))!;
    expect(retry.id).toBe(first.id);
    expect(retry.attempts).toBe(2);
    await queue.complete(retry.id, retry.leaseToken!, "sent", new Date(now.getTime() + 120000));
  });
});
afterAll(async () => {
  if (db) {
    await db.user.deleteMany({ where: { id: { in: users } } });
    await db.$disconnect();
  }
});
