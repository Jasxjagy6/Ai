ALTER TABLE "ValidatorAccount"
  ADD COLUMN "creditsBalance" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "creditsPurchased" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "creditsSpent" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "currentPlanCode" VARCHAR(40),
  ADD COLUMN "planExpiresAt" TIMESTAMP(3),
  ADD COLUMN "lastCreditTopupAt" TIMESTAMP(3),
  ADD COLUMN "referralCode" VARCHAR(20),
  ADD COLUMN "referredById" TEXT,
  ADD COLUMN "affiliateRateBps" INTEGER;

UPDATE "ValidatorAccount"
SET "referralCode" = UPPER(SUBSTRING(MD5(id || email) FROM 1 FOR 10))
WHERE "referralCode" IS NULL;

CREATE UNIQUE INDEX "ValidatorAccount_referralCode_key" ON "ValidatorAccount"("referralCode");
CREATE INDEX "ValidatorAccount_referredById_idx" ON "ValidatorAccount"("referredById");
ALTER TABLE "ValidatorAccount" ADD CONSTRAINT "ValidatorAccount_referredById_fkey"
  FOREIGN KEY ("referredById") REFERENCES "ValidatorAccount"("id") ON DELETE SET NULL ON UPDATE CASCADE;

UPDATE "ValidatorAccount" account
SET "creditsBalance" = 2500,
    "creditsPurchased" = 2500,
    "currentPlanCode" = (
      SELECT key."planCode" FROM "ValidatorAccessKey" key
      WHERE key."accountId" = account.id ORDER BY key."createdAt" DESC LIMIT 1
    ),
    "planExpiresAt" = (
      SELECT key."expiresAt" FROM "ValidatorAccessKey" key
      WHERE key."accountId" = account.id ORDER BY key."createdAt" DESC LIMIT 1
    )
WHERE account.active = TRUE;

DROP INDEX IF EXISTS "ValidatorPurchase_accessKeyId_key";
ALTER TABLE "ValidatorPurchase"
  ADD COLUMN "purchaseType" VARCHAR(20) NOT NULL DEFAULT 'plan',
  ADD COLUMN "creditsAmount" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "referralCode" VARCHAR(20),
  ADD COLUMN "fulfilledAt" TIMESTAMP(3);
CREATE INDEX "ValidatorPurchase_accessKeyId_idx" ON "ValidatorPurchase"("accessKeyId");

ALTER TABLE "LinkFilterJob" ADD COLUMN "creditsCharged" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "TelegramCampaign"
  ADD COLUMN "reservedCredits" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "creditItemCost" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "creditsSettled" BOOLEAN NOT NULL DEFAULT false;

CREATE TABLE "ValidatorCreditTransaction" (
  "id" TEXT NOT NULL,
  "accountId" TEXT NOT NULL,
  "accessKeyId" TEXT,
  "amount" INTEGER NOT NULL,
  "balanceAfter" INTEGER NOT NULL,
  "kind" VARCHAR(30) NOT NULL,
  "taskCode" VARCHAR(60),
  "description" VARCHAR(220) NOT NULL,
  "referenceType" VARCHAR(40),
  "referenceId" VARCHAR(120),
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ValidatorCreditTransaction_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "ValidatorCreditTransaction_accountId_createdAt_idx" ON "ValidatorCreditTransaction"("accountId", "createdAt");
CREATE INDEX "ValidatorCreditTransaction_referenceType_referenceId_idx" ON "ValidatorCreditTransaction"("referenceType", "referenceId");
ALTER TABLE "ValidatorCreditTransaction" ADD CONSTRAINT "ValidatorCreditTransaction_accountId_fkey"
  FOREIGN KEY ("accountId") REFERENCES "ValidatorAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ValidatorCreditTransaction" ADD CONSTRAINT "ValidatorCreditTransaction_accessKeyId_fkey"
  FOREIGN KEY ("accessKeyId") REFERENCES "ValidatorAccessKey"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "ValidatorAffiliateReward" (
  "id" TEXT NOT NULL,
  "referrerId" TEXT NOT NULL,
  "referredAccountId" TEXT NOT NULL,
  "purchaseId" TEXT NOT NULL,
  "rateBps" INTEGER NOT NULL,
  "depositUsdCents" INTEGER NOT NULL,
  "rewardCredits" INTEGER NOT NULL,
  "status" VARCHAR(20) NOT NULL DEFAULT 'credited',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ValidatorAffiliateReward_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "ValidatorAffiliateReward_purchaseId_key" ON "ValidatorAffiliateReward"("purchaseId");
CREATE INDEX "ValidatorAffiliateReward_referrerId_createdAt_idx" ON "ValidatorAffiliateReward"("referrerId", "createdAt");
CREATE INDEX "ValidatorAffiliateReward_referredAccountId_createdAt_idx" ON "ValidatorAffiliateReward"("referredAccountId", "createdAt");
ALTER TABLE "ValidatorAffiliateReward" ADD CONSTRAINT "ValidatorAffiliateReward_referrerId_fkey"
  FOREIGN KEY ("referrerId") REFERENCES "ValidatorAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ValidatorAffiliateReward" ADD CONSTRAINT "ValidatorAffiliateReward_referredAccountId_fkey"
  FOREIGN KEY ("referredAccountId") REFERENCES "ValidatorAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ValidatorAffiliateReward" ADD CONSTRAINT "ValidatorAffiliateReward_purchaseId_fkey"
  FOREIGN KEY ("purchaseId") REFERENCES "ValidatorPurchase"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "ValidatorUpdate" (
  "id" TEXT NOT NULL,
  "title" VARCHAR(160) NOT NULL,
  "body" TEXT NOT NULL,
  "tag" VARCHAR(30) NOT NULL DEFAULT 'Update',
  "published" BOOLEAN NOT NULL DEFAULT true,
  "publishedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ValidatorUpdate_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "ValidatorUpdate_published_publishedAt_idx" ON "ValidatorUpdate"("published", "publishedAt");
