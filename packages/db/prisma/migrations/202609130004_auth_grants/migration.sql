CREATE TABLE "AuthGrant" (
  "hash" TEXT PRIMARY KEY, "purpose" TEXT NOT NULL, "subject" TEXT NOT NULL,
  "challenge" TEXT, "expiresAt" TIMESTAMP(3) NOT NULL, "consumedAt" TIMESTAMP(3)
);
CREATE INDEX "AuthGrant_expiresAt_idx" ON "AuthGrant"("expiresAt");
CREATE TABLE "DeviceSession" (
  "hash" TEXT PRIMARY KEY, "userId" UUID NOT NULL REFERENCES "User"("id") ON DELETE CASCADE,
  "expiresAt" TIMESTAMP(3) NOT NULL, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "revokedAt" TIMESTAMP(3)
);
CREATE INDEX "DeviceSession_userId_idx" ON "DeviceSession"("userId");
CREATE INDEX "DeviceSession_expiresAt_idx" ON "DeviceSession"("expiresAt");
