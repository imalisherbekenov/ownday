-- Prisma accesses these tables through the server database role.
-- No Supabase Data API policies are granted to anon/authenticated clients.
ALTER TABLE "EntryOperation" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "RateLimitWindow" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "AuthGrant" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "DeviceSession" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "HabitOperation" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "HabitTombstone" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ReminderDelivery" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "AccountDeletionReceipt" ENABLE ROW LEVEL SECURITY;
