-- CreateEnum
CREATE TYPE "public"."IdentityProvider" AS ENUM ('telegram', 'email', 'google');

-- CreateEnum
CREATE TYPE "public"."HabitType" AS ENUM ('binary', 'counter', 'duration');

-- CreateEnum
CREATE TYPE "public"."EntryStatus" AS ENUM ('done', 'skip', 'miss');

-- CreateEnum
CREATE TYPE "public"."EntrySource" AS ENUM ('web', 'tg', 'mobile', 'widget');

-- CreateEnum
CREATE TYPE "public"."ReminderChannel" AS ENUM ('tg', 'push');

-- CreateTable
CREATE TABLE "public"."User" (
    "id" UUID NOT NULL,
    "timezone" TEXT NOT NULL,
    "dayStartHour" INTEGER NOT NULL DEFAULT 4,
    "locale" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Identity" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "provider" "public"."IdentityProvider" NOT NULL,
    "externalId" TEXT NOT NULL,

    CONSTRAINT "Identity_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Habit" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "icon" TEXT NOT NULL,
    "color" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "type" "public"."HabitType" NOT NULL,
    "targetValue" DECIMAL(12,3),
    "unit" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "archivedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Habit_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."ScheduleVersion" (
    "id" UUID NOT NULL,
    "habitId" UUID NOT NULL,
    "kind" TEXT NOT NULL,
    "config" JSONB NOT NULL,
    "validFrom" DATE NOT NULL,

    CONSTRAINT "ScheduleVersion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Entry" (
    "id" UUID NOT NULL,
    "habitId" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "localDate" DATE NOT NULL,
    "value" DECIMAL(12,3),
    "status" "public"."EntryStatus" NOT NULL,
    "source" "public"."EntrySource" NOT NULL,
    "clientId" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Entry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Reminder" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "habitId" UUID,
    "localTime" TIME(0) NOT NULL,
    "daysMask" INTEGER NOT NULL,
    "channel" "public"."ReminderChannel" NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "nextFireAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Reminder_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."BotSession" (
    "key" TEXT NOT NULL,
    "userId" UUID,
    "data" JSONB NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BotSession_pkey" PRIMARY KEY ("key")
);

-- CreateTable
CREATE TABLE "public"."HabitStats" (
    "habitId" UUID NOT NULL,
    "currentStreak" INTEGER NOT NULL,
    "bestStreak" INTEGER NOT NULL,
    "completionRate" DOUBLE PRECISION,
    "computedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "HabitStats_pkey" PRIMARY KEY ("habitId")
);

-- CreateTable
CREATE TABLE "public"."HabitTemplate" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "icon" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "defaultSchedule" JSONB NOT NULL,
    "defaultType" "public"."HabitType" NOT NULL,
    "locale" TEXT NOT NULL,

    CONSTRAINT "HabitTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Identity_userId_idx" ON "public"."Identity"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "Identity_provider_externalId_key" ON "public"."Identity"("provider", "externalId");

-- CreateIndex
CREATE INDEX "Habit_userId_archivedAt_idx" ON "public"."Habit"("userId", "archivedAt");

-- CreateIndex
CREATE UNIQUE INDEX "ScheduleVersion_habitId_validFrom_key" ON "public"."ScheduleVersion"("habitId", "validFrom");

-- CreateIndex
CREATE INDEX "Entry_userId_localDate_idx" ON "public"."Entry"("userId", "localDate");

-- CreateIndex
CREATE UNIQUE INDEX "Entry_habitId_localDate_key" ON "public"."Entry"("habitId", "localDate");

-- CreateIndex
CREATE UNIQUE INDEX "Entry_clientId_key" ON "public"."Entry"("clientId");

-- CreateIndex
CREATE INDEX "Reminder_userId_idx" ON "public"."Reminder"("userId");

-- CreateIndex
CREATE INDEX "Reminder_enabled_nextFireAt_idx" ON "public"."Reminder"("enabled", "nextFireAt");

-- CreateIndex
CREATE INDEX "BotSession_userId_idx" ON "public"."BotSession"("userId");

-- CreateIndex
CREATE INDEX "HabitTemplate_locale_category_idx" ON "public"."HabitTemplate"("locale", "category");

-- AddForeignKey
ALTER TABLE "public"."Identity" ADD CONSTRAINT "Identity_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Habit" ADD CONSTRAINT "Habit_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ScheduleVersion" ADD CONSTRAINT "ScheduleVersion_habitId_fkey" FOREIGN KEY ("habitId") REFERENCES "public"."Habit"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Entry" ADD CONSTRAINT "Entry_habitId_fkey" FOREIGN KEY ("habitId") REFERENCES "public"."Habit"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Entry" ADD CONSTRAINT "Entry_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Reminder" ADD CONSTRAINT "Reminder_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Reminder" ADD CONSTRAINT "Reminder_habitId_fkey" FOREIGN KEY ("habitId") REFERENCES "public"."Habit"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."BotSession" ADD CONSTRAINT "BotSession_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."HabitStats" ADD CONSTRAINT "HabitStats_habitId_fkey" FOREIGN KEY ("habitId") REFERENCES "public"."Habit"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Partial index: not representable in Prisma schema syntax.
-- The reminder worker selects due rows by this index instead of holding a timer per user.
CREATE INDEX "reminder_next_fire_at_idx"
ON "Reminder" ("nextFireAt")
WHERE "enabled" = true;
