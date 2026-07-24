-- Durable Telegram spam status, health, warmup state, and behavior audit trail.
ALTER TABLE "TelegramSession"
  ADD COLUMN "spamCheckedAt" TIMESTAMP(3),
  ADD COLUMN "spamStatusMessage" TEXT,
  ADD COLUMN "spamCheckRequested" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN "spamCheckClaimedAt" TIMESTAMP(3),
  ADD COLUMN "healthCooldownUntil" TIMESTAMP(3),
  ADD COLUMN "consecutiveFloodWaits" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "lastFloodSeconds" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "lastFloodAt" TIMESTAMP(3),
  ADD COLUMN "consecutiveSendFailures" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "warmupEnabled" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN "warmupMode" VARCHAR(20) NOT NULL DEFAULT 'safe',
  ADD COLUMN "warmupStartedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  ADD COLUMN "warmupCompletedAt" TIMESTAMP(3),
  ADD COLUMN "lastWarmupAt" TIMESTAMP(3),
  ADD COLUMN "warmupActions" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "warmupRequested" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "warmupClaimedAt" TIMESTAMP(3),
  ADD COLUMN "dailyMessagesSent" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "dailyMessagesResetAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

CREATE TABLE "TelegramBehaviorLog" (
  "id" TEXT NOT NULL,
  "accountId" TEXT NOT NULL,
  "sessionId" TEXT,
  "campaignId" TEXT,
  "action" VARCHAR(64) NOT NULL,
  "target" VARCHAR(220),
  "succeeded" BOOLEAN NOT NULL DEFAULT true,
  "severity" VARCHAR(16) NOT NULL DEFAULT 'info',
  "errorCode" VARCHAR(100),
  "errorMessage" TEXT,
  "details" JSONB,
  "performedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "TelegramBehaviorLog_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "TelegramSession_spamStatus_spamLimitUntil_idx" ON "TelegramSession"("spamStatus", "spamLimitUntil");
CREATE INDEX "TelegramSession_healthCooldownUntil_idx" ON "TelegramSession"("healthCooldownUntil");
CREATE INDEX "TelegramSession_warmupEnabled_lastWarmupAt_idx" ON "TelegramSession"("warmupEnabled", "lastWarmupAt");
CREATE INDEX "TelegramSession_spamCheckRequested_spamCheckClaimedAt_idx" ON "TelegramSession"("spamCheckRequested", "spamCheckClaimedAt");
CREATE INDEX "TelegramSession_warmupRequested_warmupClaimedAt_idx" ON "TelegramSession"("warmupRequested", "warmupClaimedAt");
CREATE INDEX "TelegramBehaviorLog_accountId_performedAt_idx" ON "TelegramBehaviorLog"("accountId", "performedAt");
CREATE INDEX "TelegramBehaviorLog_sessionId_performedAt_idx" ON "TelegramBehaviorLog"("sessionId", "performedAt");
CREATE INDEX "TelegramBehaviorLog_campaignId_performedAt_idx" ON "TelegramBehaviorLog"("campaignId", "performedAt");
CREATE INDEX "TelegramBehaviorLog_severity_performedAt_idx" ON "TelegramBehaviorLog"("severity", "performedAt");

ALTER TABLE "TelegramBehaviorLog" ADD CONSTRAINT "TelegramBehaviorLog_accountId_fkey"
  FOREIGN KEY ("accountId") REFERENCES "ValidatorAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TelegramBehaviorLog" ADD CONSTRAINT "TelegramBehaviorLog_sessionId_fkey"
  FOREIGN KEY ("sessionId") REFERENCES "TelegramSession"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "TelegramBehaviorLog" ADD CONSTRAINT "TelegramBehaviorLog_campaignId_fkey"
  FOREIGN KEY ("campaignId") REFERENCES "TelegramCampaign"("id") ON DELETE SET NULL ON UPDATE CASCADE;
