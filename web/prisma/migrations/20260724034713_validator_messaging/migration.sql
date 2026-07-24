/*
  Warnings:

  - Made the column `lastProgressAt` on table `LinkFilterJob` required. This step will fail if there are existing NULL values in that column.

*/
-- AlterTable
UPDATE "LinkFilterJob" SET "lastProgressAt" = CURRENT_TIMESTAMP WHERE "lastProgressAt" IS NULL;
ALTER TABLE "LinkFilterJob" ALTER COLUMN "lastProgressAt" SET NOT NULL,
ALTER COLUMN "lastProgressAt" SET DEFAULT CURRENT_TIMESTAMP;

-- AlterTable
ALTER TABLE "ValidatorAccessKey" ADD COLUMN     "messageLimit" INTEGER,
ADD COLUMN     "messagesUsed" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "messagingAccess" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "sessionLimit" INTEGER,
ADD COLUMN     "validatorAccess" BOOLEAN NOT NULL DEFAULT true;

-- AlterTable
ALTER TABLE "ValidatorPurchase" ADD COLUMN     "messageLimit" INTEGER,
ADD COLUMN     "messagingAccess" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "sessionLimit" INTEGER,
ADD COLUMN     "validatorAccess" BOOLEAN NOT NULL DEFAULT true;

-- CreateTable
CREATE TABLE "TelegramApiCredential" (
    "id" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "label" VARCHAR(80) NOT NULL DEFAULT 'Telegram API',
    "apiId" INTEGER NOT NULL,
    "apiHashEncrypted" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TelegramApiCredential_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TelegramSession" (
    "id" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "credentialId" TEXT NOT NULL,
    "label" VARCHAR(100) NOT NULL,
    "phone" VARCHAR(30),
    "username" VARCHAR(100),
    "firstName" VARCHAR(100),
    "lastName" VARCHAR(100),
    "telegramUserId" BIGINT,
    "sessionDataEncrypted" TEXT NOT NULL,
    "sessionFingerprint" VARCHAR(64) NOT NULL,
    "sessionFormat" VARCHAR(30) NOT NULL DEFAULT 'session_string',
    "sourceFilename" VARCHAR(255),
    "status" VARCHAR(30) NOT NULL DEFAULT 'uploaded',
    "isLoggedIn" BOOLEAN NOT NULL DEFAULT false,
    "hasTwoFactor" BOOLEAN NOT NULL DEFAULT false,
    "antiDetectEnabled" BOOLEAN NOT NULL DEFAULT true,
    "deviceIdentity" JSONB,
    "proxyEncrypted" TEXT,
    "proxyLabel" VARCHAR(100),
    "proxyEnabled" BOOLEAN NOT NULL DEFAULT false,
    "riskScore" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "spamStatus" VARCHAR(30) NOT NULL DEFAULT 'unknown',
    "spamLimitUntil" TIMESTAMP(3),
    "lastErrorCode" VARCHAR(100),
    "lastErrorMessage" TEXT,
    "lastLoginAt" TIMESTAMP(3),
    "lastActiveAt" TIMESTAMP(3),
    "messagesSent" INTEGER NOT NULL DEFAULT 0,
    "repliesReceived" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TelegramSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TelegramSessionList" (
    "id" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "name" VARCHAR(120) NOT NULL,
    "description" VARCHAR(500),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TelegramSessionList_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TelegramSessionListMember" (
    "listId" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "position" INTEGER NOT NULL DEFAULT 0,
    "addedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TelegramSessionListMember_pkey" PRIMARY KEY ("listId","sessionId")
);

-- CreateTable
CREATE TABLE "TelegramLoginFlow" (
    "id" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "credentialId" TEXT NOT NULL,
    "phone" VARCHAR(30) NOT NULL,
    "label" VARCHAR(100) NOT NULL,
    "status" VARCHAR(30) NOT NULL DEFAULT 'pending_code',
    "codeEncrypted" TEXT,
    "passwordEncrypted" TEXT,
    "phoneCodeHashEncrypted" TEXT,
    "deviceIdentity" JSONB,
    "proxyEncrypted" TEXT,
    "errorCode" VARCHAR(100),
    "errorMessage" TEXT,
    "sessionId" TEXT,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TelegramLoginFlow_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TelegramCampaign" (
    "id" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "accessKeyId" TEXT,
    "sourceListId" TEXT,
    "scheduleId" TEXT,
    "name" VARCHAR(160) NOT NULL,
    "targetType" VARCHAR(20) NOT NULL DEFAULT 'users',
    "mode" VARCHAR(30) NOT NULL DEFAULT 'balanced',
    "message" TEXT NOT NULL,
    "parseMode" VARCHAR(20) NOT NULL DEFAULT 'text',
    "status" VARCHAR(30) NOT NULL DEFAULT 'pending',
    "totalCount" INTEGER NOT NULL DEFAULT 0,
    "processedCount" INTEGER NOT NULL DEFAULT 0,
    "sentCount" INTEGER NOT NULL DEFAULT 0,
    "failedCount" INTEGER NOT NULL DEFAULT 0,
    "skippedCount" INTEGER NOT NULL DEFAULT 0,
    "repliedCount" INTEGER NOT NULL DEFAULT 0,
    "sessionCount" INTEGER NOT NULL DEFAULT 0,
    "configuration" JSONB,
    "trackReplies" BOOLEAN NOT NULL DEFAULT true,
    "replyWindowHours" INTEGER NOT NULL DEFAULT 24,
    "replyTrackingStatus" VARCHAR(30) NOT NULL DEFAULT 'pending',
    "replyTrackingUntil" TIMESTAMP(3),
    "replyTrackingLastScanAt" TIMESTAMP(3),
    "cancelRequested" BOOLEAN NOT NULL DEFAULT false,
    "currentTarget" VARCHAR(150),
    "errorMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "startedAt" TIMESTAMP(3),
    "finishedAt" TIMESTAMP(3),
    "lastProgressAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TelegramCampaign_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TelegramCampaignSession" (
    "campaignId" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "position" INTEGER NOT NULL DEFAULT 0,
    "status" VARCHAR(30) NOT NULL DEFAULT 'pending',
    "assignedCount" INTEGER NOT NULL DEFAULT 0,
    "sentCount" INTEGER NOT NULL DEFAULT 0,
    "failedCount" INTEGER NOT NULL DEFAULT 0,
    "lastErrorCode" VARCHAR(100),
    "lastErrorMessage" TEXT,
    "retiredAt" TIMESTAMP(3),

    CONSTRAINT "TelegramCampaignSession_pkey" PRIMARY KEY ("campaignId","sessionId")
);

-- CreateTable
CREATE TABLE "TelegramCampaignRecipient" (
    "id" TEXT NOT NULL,
    "campaignId" TEXT NOT NULL,
    "sessionId" TEXT,
    "targetKey" VARCHAR(220) NOT NULL,
    "targetInput" VARCHAR(220) NOT NULL,
    "username" VARCHAR(100),
    "telegramId" BIGINT,
    "accessHash" BIGINT,
    "phone" VARCHAR(30),
    "displayName" VARCHAR(180),
    "peerId" BIGINT,
    "status" VARCHAR(30) NOT NULL DEFAULT 'pending',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "messageId" BIGINT,
    "errorCode" VARCHAR(100),
    "errorMessage" TEXT,
    "sentAt" TIMESTAMP(3),
    "replied" BOOLEAN NOT NULL DEFAULT false,
    "repliedAt" TIMESTAMP(3),
    "replyMessageId" BIGINT,
    "replyPreview" VARCHAR(500),
    "lastCheckedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TelegramCampaignRecipient_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TelegramMessageSchedule" (
    "id" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "accessKeyId" TEXT,
    "sourceListId" TEXT,
    "name" VARCHAR(160) NOT NULL,
    "targetType" VARCHAR(20) NOT NULL DEFAULT 'groups',
    "mode" VARCHAR(30) NOT NULL DEFAULT 'balanced',
    "message" TEXT NOT NULL,
    "parseMode" VARCHAR(20) NOT NULL DEFAULT 'text',
    "sessionIds" JSONB NOT NULL,
    "manualTargets" JSONB,
    "configuration" JSONB,
    "intervalMinutes" INTEGER NOT NULL,
    "status" VARCHAR(30) NOT NULL DEFAULT 'active',
    "runCount" INTEGER NOT NULL DEFAULT 0,
    "nextRunAt" TIMESTAMP(3) NOT NULL,
    "lastRunAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TelegramMessageSchedule_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "TelegramApiCredential_accountId_key" ON "TelegramApiCredential"("accountId");

-- CreateIndex
CREATE INDEX "TelegramSession_accountId_createdAt_idx" ON "TelegramSession"("accountId", "createdAt");

-- CreateIndex
CREATE INDEX "TelegramSession_accountId_status_idx" ON "TelegramSession"("accountId", "status");

-- CreateIndex
CREATE INDEX "TelegramSession_credentialId_idx" ON "TelegramSession"("credentialId");

-- CreateIndex
CREATE UNIQUE INDEX "TelegramSession_accountId_sessionFingerprint_key" ON "TelegramSession"("accountId", "sessionFingerprint");

-- CreateIndex
CREATE INDEX "TelegramSessionList_accountId_createdAt_idx" ON "TelegramSessionList"("accountId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "TelegramSessionList_accountId_name_key" ON "TelegramSessionList"("accountId", "name");

-- CreateIndex
CREATE INDEX "TelegramSessionListMember_sessionId_idx" ON "TelegramSessionListMember"("sessionId");

-- CreateIndex
CREATE INDEX "TelegramLoginFlow_accountId_createdAt_idx" ON "TelegramLoginFlow"("accountId", "createdAt");

-- CreateIndex
CREATE INDEX "TelegramLoginFlow_status_updatedAt_idx" ON "TelegramLoginFlow"("status", "updatedAt");

-- CreateIndex
CREATE INDEX "TelegramCampaign_accountId_createdAt_idx" ON "TelegramCampaign"("accountId", "createdAt");

-- CreateIndex
CREATE INDEX "TelegramCampaign_status_createdAt_idx" ON "TelegramCampaign"("status", "createdAt");

-- CreateIndex
CREATE INDEX "TelegramCampaign_replyTrackingStatus_replyTrackingUntil_idx" ON "TelegramCampaign"("replyTrackingStatus", "replyTrackingUntil");

-- CreateIndex
CREATE INDEX "TelegramCampaign_scheduleId_idx" ON "TelegramCampaign"("scheduleId");

-- CreateIndex
CREATE INDEX "TelegramCampaignSession_sessionId_idx" ON "TelegramCampaignSession"("sessionId");

-- CreateIndex
CREATE INDEX "TelegramCampaignRecipient_campaignId_status_createdAt_idx" ON "TelegramCampaignRecipient"("campaignId", "status", "createdAt");

-- CreateIndex
CREATE INDEX "TelegramCampaignRecipient_sessionId_sentAt_idx" ON "TelegramCampaignRecipient"("sessionId", "sentAt");

-- CreateIndex
CREATE INDEX "TelegramCampaignRecipient_campaignId_replied_idx" ON "TelegramCampaignRecipient"("campaignId", "replied");

-- CreateIndex
CREATE UNIQUE INDEX "TelegramCampaignRecipient_campaignId_targetKey_key" ON "TelegramCampaignRecipient"("campaignId", "targetKey");

-- CreateIndex
CREATE INDEX "TelegramMessageSchedule_accountId_createdAt_idx" ON "TelegramMessageSchedule"("accountId", "createdAt");

-- CreateIndex
CREATE INDEX "TelegramMessageSchedule_accessKeyId_idx" ON "TelegramMessageSchedule"("accessKeyId");

-- CreateIndex
CREATE INDEX "TelegramMessageSchedule_status_nextRunAt_idx" ON "TelegramMessageSchedule"("status", "nextRunAt");

-- AddForeignKey
ALTER TABLE "TelegramApiCredential" ADD CONSTRAINT "TelegramApiCredential_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "ValidatorAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TelegramSession" ADD CONSTRAINT "TelegramSession_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "ValidatorAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TelegramSession" ADD CONSTRAINT "TelegramSession_credentialId_fkey" FOREIGN KEY ("credentialId") REFERENCES "TelegramApiCredential"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TelegramSessionList" ADD CONSTRAINT "TelegramSessionList_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "ValidatorAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TelegramSessionListMember" ADD CONSTRAINT "TelegramSessionListMember_listId_fkey" FOREIGN KEY ("listId") REFERENCES "TelegramSessionList"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TelegramSessionListMember" ADD CONSTRAINT "TelegramSessionListMember_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "TelegramSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TelegramLoginFlow" ADD CONSTRAINT "TelegramLoginFlow_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "ValidatorAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TelegramLoginFlow" ADD CONSTRAINT "TelegramLoginFlow_credentialId_fkey" FOREIGN KEY ("credentialId") REFERENCES "TelegramApiCredential"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TelegramCampaign" ADD CONSTRAINT "TelegramCampaign_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "ValidatorAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TelegramCampaign" ADD CONSTRAINT "TelegramCampaign_accessKeyId_fkey" FOREIGN KEY ("accessKeyId") REFERENCES "ValidatorAccessKey"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TelegramCampaign" ADD CONSTRAINT "TelegramCampaign_sourceListId_fkey" FOREIGN KEY ("sourceListId") REFERENCES "ContactList"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TelegramCampaign" ADD CONSTRAINT "TelegramCampaign_scheduleId_fkey" FOREIGN KEY ("scheduleId") REFERENCES "TelegramMessageSchedule"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TelegramCampaignSession" ADD CONSTRAINT "TelegramCampaignSession_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "TelegramCampaign"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TelegramCampaignSession" ADD CONSTRAINT "TelegramCampaignSession_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "TelegramSession"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TelegramCampaignRecipient" ADD CONSTRAINT "TelegramCampaignRecipient_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "TelegramCampaign"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TelegramCampaignRecipient" ADD CONSTRAINT "TelegramCampaignRecipient_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "TelegramSession"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TelegramMessageSchedule" ADD CONSTRAINT "TelegramMessageSchedule_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "ValidatorAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TelegramMessageSchedule" ADD CONSTRAINT "TelegramMessageSchedule_accessKeyId_fkey" FOREIGN KEY ("accessKeyId") REFERENCES "ValidatorAccessKey"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TelegramMessageSchedule" ADD CONSTRAINT "TelegramMessageSchedule_sourceListId_fkey" FOREIGN KEY ("sourceListId") REFERENCES "ContactList"("id") ON DELETE SET NULL ON UPDATE CASCADE;
