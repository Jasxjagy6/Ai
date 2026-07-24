ALTER TABLE "ValidatorAccessKey"
  ADD COLUMN "requestLimit" INTEGER,
  ADD COLUMN "requestsUsed" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "planCode" VARCHAR(40);

ALTER TABLE "ValidatorSession" ADD COLUMN "accessKeyId" TEXT;
CREATE INDEX "ValidatorSession_accessKeyId_idx" ON "ValidatorSession"("accessKeyId");
ALTER TABLE "ValidatorSession"
  ADD CONSTRAINT "ValidatorSession_accessKeyId_fkey"
  FOREIGN KEY ("accessKeyId") REFERENCES "ValidatorAccessKey"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "ValidatorPurchase" (
  "id" TEXT NOT NULL,
  "accountId" TEXT NOT NULL,
  "accessKeyId" TEXT,
  "email" VARCHAR(254) NOT NULL,
  "planCode" VARCHAR(40) NOT NULL,
  "planName" VARCHAR(80) NOT NULL,
  "status" VARCHAR(24) NOT NULL DEFAULT 'created',
  "provider" VARCHAR(30) NOT NULL DEFAULT 'oxapay',
  "providerTrackId" VARCHAR(120),
  "amountUsdCents" INTEGER NOT NULL DEFAULT 0,
  "durationDays" INTEGER,
  "requestLimit" INTEGER,
  "claimTokenHash" VARCHAR(64) NOT NULL,
  "paymentUrl" TEXT,
  "paidAt" TIMESTAMP(3),
  "claimedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ValidatorPurchase_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ValidatorPurchase_accessKeyId_key" ON "ValidatorPurchase"("accessKeyId");
CREATE UNIQUE INDEX "ValidatorPurchase_providerTrackId_key" ON "ValidatorPurchase"("providerTrackId");
CREATE UNIQUE INDEX "ValidatorPurchase_claimTokenHash_key" ON "ValidatorPurchase"("claimTokenHash");
CREATE INDEX "ValidatorPurchase_email_createdAt_idx" ON "ValidatorPurchase"("email", "createdAt");
CREATE INDEX "ValidatorPurchase_status_createdAt_idx" ON "ValidatorPurchase"("status", "createdAt");

ALTER TABLE "ValidatorPurchase"
  ADD CONSTRAINT "ValidatorPurchase_accountId_fkey"
  FOREIGN KEY ("accountId") REFERENCES "ValidatorAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ValidatorPurchase"
  ADD CONSTRAINT "ValidatorPurchase_accessKeyId_fkey"
  FOREIGN KEY ("accessKeyId") REFERENCES "ValidatorAccessKey"("id") ON DELETE SET NULL ON UPDATE CASCADE;
