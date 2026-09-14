CREATE TABLE "RateLimitWindow" (
  "key" TEXT NOT NULL PRIMARY KEY,
  "hits" INTEGER NOT NULL,
  "expiresAt" TIMESTAMP(3) NOT NULL
);
CREATE INDEX "RateLimitWindow_expiresAt_idx" ON "RateLimitWindow"("expiresAt");

-- Capture the migration baseline before new edits can change legacy receipts.
-- No existing Entry identifier, value or history is changed.
INSERT INTO "EntryOperation" ("userId", "operationId", "habitId", "localDate", "payload", "result")
SELECT e."userId", e."clientId", e."habitId", e."localDate", '{"legacy":true}'::jsonb,
  jsonb_build_object('operationId', e."clientId", 'outcome', 'applied', 'revision', e."revision",
    'entry', CASE WHEN e."deleted" THEN 'null'::jsonb ELSE
      to_jsonb(e) || jsonb_build_object(
        'createdAt', to_char(e."createdAt", 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),
        'updatedAt', to_char(e."updatedAt", 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')) END)
FROM "Entry" e ON CONFLICT ("userId", "operationId") DO NOTHING;
