ALTER TABLE "Habit" ADD COLUMN "revision" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "Habit" ADD COLUMN "journalMetadata" JSONB NOT NULL DEFAULT '{}';
CREATE TABLE "HabitOperation" (
  "userId" UUID NOT NULL REFERENCES "User"("id") ON DELETE CASCADE,
  "operationId" UUID NOT NULL, "habitId" UUID NOT NULL,
  "payload" JSONB NOT NULL, "result" JSONB NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY ("userId", "operationId")
);
CREATE INDEX "HabitOperation_userId_habitId_idx" ON "HabitOperation"("userId", "habitId");
