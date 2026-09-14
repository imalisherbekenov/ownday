CREATE TABLE "AccountDeletionReceipt" (
  "sessionHash" TEXT NOT NULL,
  "userHash" TEXT NOT NULL,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "AccountDeletionReceipt_pkey" PRIMARY KEY ("sessionHash")
);
CREATE INDEX "AccountDeletionReceipt_expiresAt_idx" ON "AccountDeletionReceipt"("expiresAt");
