CREATE TABLE "ReminderDelivery" (
  "id" UUID NOT NULL PRIMARY KEY,
  "reminderId" UUID NOT NULL,
  "scheduledAt" TIMESTAMP(3) NOT NULL,
  "localDate" VARCHAR(10) NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'pending',
  "attempts" INTEGER NOT NULL DEFAULT 0,
  "nextAttemptAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "leaseToken" UUID,
  "leaseUntil" TIMESTAMP(3),
  "lastError" TEXT,
  "completedAt" TIMESTAMP(3),
  CONSTRAINT "ReminderDelivery_reminderId_fkey" FOREIGN KEY ("reminderId") REFERENCES "Reminder"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "ReminderDelivery_reminderId_scheduledAt_key" ON "ReminderDelivery"("reminderId","scheduledAt");
CREATE INDEX "ReminderDelivery_status_nextAttemptAt_leaseUntil_idx" ON "ReminderDelivery"("status","nextAttemptAt","leaseUntil");
