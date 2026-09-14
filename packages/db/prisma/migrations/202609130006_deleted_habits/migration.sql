-- Retain only identifiers after an explicit permanent deletion, preventing stale devices from recreating it.
CREATE TABLE "HabitTombstone" (
  "habitId" UUID NOT NULL PRIMARY KEY,
  "userId" UUID NOT NULL,
  "deletedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "HabitTombstone_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "HabitTombstone_userId_idx" ON "HabitTombstone"("userId");
