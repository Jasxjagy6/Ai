-- Durable account-settings batches and per-session worker jobs.
-- The previous implementation created this table from API requests and never
-- inserted a valid row, so replace that incomplete runtime schema.
DROP TABLE IF EXISTS "TelegramAccountSettingsJob";

CREATE TABLE "TelegramAccountSettingsBatch" (
  "id" TEXT NOT NULL,
  "accountId" TEXT NOT NULL,
  "kind" VARCHAR(40) NOT NULL,
  "status" VARCHAR(20) NOT NULL DEFAULT 'pending',
  "totalCount" INTEGER NOT NULL DEFAULT 0,
  "processedCount" INTEGER NOT NULL DEFAULT 0,
  "succeededCount" INTEGER NOT NULL DEFAULT 0,
  "failedCount" INTEGER NOT NULL DEFAULT 0,
  "skippedCount" INTEGER NOT NULL DEFAULT 0,
  "cancelRequested" BOOLEAN NOT NULL DEFAULT false,
  "metadata" JSONB,
  "errorMessage" TEXT,
  "startedAt" TIMESTAMP(3),
  "finishedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "TelegramAccountSettingsBatch_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "TelegramAccountSettingsJob" (
  "id" TEXT NOT NULL,
  "batchId" TEXT NOT NULL,
  "accountId" TEXT NOT NULL,
  "sessionId" TEXT NOT NULL,
  "action" VARCHAR(40) NOT NULL,
  "status" VARCHAR(20) NOT NULL DEFAULT 'pending',
  "position" INTEGER NOT NULL DEFAULT 0,
  "payload" JSONB,
  "result" JSONB,
  "errorCode" VARCHAR(100),
  "errorMessage" TEXT,
  "attempts" INTEGER NOT NULL DEFAULT 0,
  "claimedAt" TIMESTAMP(3),
  "finishedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "TelegramAccountSettingsJob_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "TelegramAccountSettingsBatch_accountId_createdAt_idx" ON "TelegramAccountSettingsBatch"("accountId", "createdAt");
CREATE INDEX "TelegramAccountSettingsBatch_status_createdAt_idx" ON "TelegramAccountSettingsBatch"("status", "createdAt");
CREATE INDEX "TelegramAccountSettingsJob_status_createdAt_idx" ON "TelegramAccountSettingsJob"("status", "createdAt");
CREATE INDEX "TelegramAccountSettingsJob_batchId_status_position_idx" ON "TelegramAccountSettingsJob"("batchId", "status", "position");
CREATE INDEX "TelegramAccountSettingsJob_accountId_createdAt_idx" ON "TelegramAccountSettingsJob"("accountId", "createdAt");
CREATE INDEX "TelegramAccountSettingsJob_sessionId_createdAt_idx" ON "TelegramAccountSettingsJob"("sessionId", "createdAt");

ALTER TABLE "TelegramAccountSettingsBatch" ADD CONSTRAINT "TelegramAccountSettingsBatch_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "ValidatorAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TelegramAccountSettingsJob" ADD CONSTRAINT "TelegramAccountSettingsJob_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "TelegramAccountSettingsBatch"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TelegramAccountSettingsJob" ADD CONSTRAINT "TelegramAccountSettingsJob_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "ValidatorAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TelegramAccountSettingsJob" ADD CONSTRAINT "TelegramAccountSettingsJob_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "TelegramSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;
