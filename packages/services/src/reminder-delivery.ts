import { randomUUID } from "node:crypto";
import { localDateFor, nextFireAt } from "@ownday/core";
import type { PrismaClient } from "@ownday/db";
export class ReminderDeliveryQueue {
  constructor(private db: PrismaClient) {}
  async prepare(now: Date, limit = 20) {
    if (!Number.isInteger(limit) || limit < 1 || limit > 100) throw new Error("INVALID_LIMIT");
    return this.db.$transaction(
      async (tx) => {
        const rows = await tx.$queryRaw<
          Array<{ id: string }>
        >`SELECT "id" FROM "Reminder" WHERE "enabled"=true AND "channel"='tg' AND "nextFireAt"<=${now.toISOString()}::timestamp ORDER BY "nextFireAt" LIMIT ${limit} FOR UPDATE SKIP LOCKED`;
        for (const row of rows) {
          const reminder = await tx.reminder.findUniqueOrThrow({
            where: { id: row.id },
            include: { user: true },
          });
          const scheduledAt = reminder.nextFireAt;
          await tx.reminderDelivery.upsert({
            where: { reminderId_scheduledAt: { reminderId: row.id, scheduledAt } },
            create: {
              reminderId: row.id,
              scheduledAt,
              localDate: localDateFor(
                scheduledAt,
                reminder.user.timezone,
                reminder.user.dayStartHour,
              ),
              nextAttemptAt: now,
            },
            update: {},
          });
          await tx.reminder.update({
            where: { id: row.id },
            data: {
              nextFireAt: nextFireAt(
                {
                  localTime: reminder.localTime.toISOString().slice(11, 19),
                  daysMask: reminder.daysMask,
                },
                reminder.user.timezone,
                now,
              ),
            },
          });
        }
        return rows.length;
      },
      { timeout: 60000 },
    );
  }
  async claim(now: Date) {
    return this.db.$transaction(async (tx) => {
      await tx.reminderDelivery.updateMany({
        where: { status: "processing", leaseUntil: { lte: now }, attempts: { gte: 5 } },
        data: { status: "failed", lastError: "LEASE_EXPIRED", leaseToken: null, leaseUntil: null },
      });
      const rows = await tx.$queryRaw<
        Array<{ id: string }>
      >`SELECT "id" FROM "ReminderDelivery" WHERE ("status"='pending' AND "nextAttemptAt"<=${now.toISOString()}::timestamp) OR ("status"='processing' AND "leaseUntil"<=${now.toISOString()}::timestamp) ORDER BY "nextAttemptAt" LIMIT 1 FOR UPDATE SKIP LOCKED`;
      if (!rows[0]) return null;
      return tx.reminderDelivery.update({
        where: { id: rows[0].id },
        data: {
          status: "processing",
          attempts: { increment: 1 },
          leaseToken: randomUUID(),
          leaseUntil: new Date(now.getTime() + 90000),
        },
        include: { reminder: { include: { user: true } } },
      });
    });
  }
  async complete(id: string, leaseToken: string, status: "sent" | "skipped", now: Date) {
    return (
      (
        await this.db.reminderDelivery.updateMany({
          where: { id, leaseToken, status: "processing" },
          data: { status, completedAt: now, leaseToken: null, leaseUntil: null },
        })
      ).count === 1
    );
  }
  async fail(
    id: string,
    leaseToken: string,
    now: Date,
    errorCode: string,
    retryAfterSeconds?: number,
    permanent = false,
  ) {
    return this.db.$transaction(async (tx) => {
      const job = await tx.reminderDelivery.findFirst({
        where: { id, leaseToken, status: "processing" },
      });
      if (!job) return false;
      const exhausted = permanent || job.attempts >= 5;
      const delay = Math.min(
        86400,
        Math.max(
          30,
          Number.isFinite(retryAfterSeconds)
            ? retryAfterSeconds!
            : 30 * 2 ** Math.min(job.attempts - 1, 10),
        ),
      );
      const changed = await tx.reminderDelivery.updateMany({
        where: { id, leaseToken, status: "processing" },
        data: {
          status: exhausted ? "failed" : "pending",
          lastError: errorCode.slice(0, 80),
          nextAttemptAt: new Date(now.getTime() + delay * 1000),
          leaseToken: null,
          leaseUntil: null,
        },
      });
      if (changed.count && errorCode === "TELEGRAM_403")
        await tx.reminder.update({ where: { id: job.reminderId }, data: { enabled: false } });
      return changed.count === 1;
    });
  }
}
