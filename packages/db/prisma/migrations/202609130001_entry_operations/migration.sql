ALTER TABLE "Entry" ADD COLUMN "revision" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "deleted" BOOLEAN NOT NULL DEFAULT false;

CREATE TABLE "EntryOperation" (
  "userId" UUID NOT NULL,
  "operationId" UUID NOT NULL,
  "habitId" UUID NOT NULL,
  "localDate" DATE NOT NULL,
  "sequence" BIGSERIAL NOT NULL,
  "payload" JSONB NOT NULL,
  "result" JSONB NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "EntryOperation_pkey" PRIMARY KEY ("userId", "operationId"),
  CONSTRAINT "EntryOperation_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "EntryOperation_habitId_fkey" FOREIGN KEY ("habitId") REFERENCES "Habit"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "EntryOperation_sequence_key" ON "EntryOperation"("sequence");
CREATE INDEX "EntryOperation_userId_sequence_idx" ON "EntryOperation"("userId", "sequence");
