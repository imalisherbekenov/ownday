-- PostgreSQL partial indexes are not representable in Prisma 6 schema syntax.
-- Include this statement in the first future migration; it is intentionally not applied here.
CREATE INDEX "reminder_next_fire_at_idx"
ON "Reminder" ("nextFireAt")
WHERE "enabled" = true;
