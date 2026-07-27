CREATE TABLE "ValidatorTelegramTrial" (
    "id" TEXT NOT NULL,
    "telegramUserId" BIGINT NOT NULL,
    "telegramUsername" VARCHAR(100),
    "telegramFirstName" VARCHAR(100),
    "telegramLastName" VARCHAR(100),
    "accountId" TEXT NOT NULL,
    "accessKeyId" TEXT NOT NULL,
    "creditsGranted" INTEGER NOT NULL DEFAULT 2500,
    "claimedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ValidatorTelegramTrial_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ValidatorTelegramTrial_telegramUserId_key" ON "ValidatorTelegramTrial"("telegramUserId");
CREATE UNIQUE INDEX "ValidatorTelegramTrial_accountId_key" ON "ValidatorTelegramTrial"("accountId");
CREATE UNIQUE INDEX "ValidatorTelegramTrial_accessKeyId_key" ON "ValidatorTelegramTrial"("accessKeyId");
CREATE INDEX "ValidatorTelegramTrial_expiresAt_idx" ON "ValidatorTelegramTrial"("expiresAt");

ALTER TABLE "ValidatorTelegramTrial" ADD CONSTRAINT "ValidatorTelegramTrial_accountId_fkey"
  FOREIGN KEY ("accountId") REFERENCES "ValidatorAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ValidatorTelegramTrial" ADD CONSTRAINT "ValidatorTelegramTrial_accessKeyId_fkey"
  FOREIGN KEY ("accessKeyId") REFERENCES "ValidatorAccessKey"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Plans differ by included credits and commercial terms, not feature gates.
UPDATE "ValidatorAccessKey" SET
  "validatorAccess" = TRUE,
  "messagingAccess" = TRUE,
  "requestLimit" = NULL,
  "sessionLimit" = NULL,
  "messageLimit" = NULL;
