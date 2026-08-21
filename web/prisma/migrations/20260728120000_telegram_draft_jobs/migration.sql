-- Durable Telegram draft jobs, per-session work, and per-chat outcomes.
CREATE TABLE "TelegramDraftJob" (
  "id" TEXT NOT NULL,
  "accountId" TEXT NOT NULL,
  "name" VARCHAR(160) NOT NULL,
  "message" TEXT NOT NULL,
  "scope" VARCHAR(20) NOT NULL DEFAULT 'both',
  "filterWords" JSONB NOT NULL,
  "historyDepth" INTEGER NOT NULL DEFAULT 10,
  "status" VARCHAR(20) NOT NULL DEFAULT 'pending',
  "totalSessions" INTEGER NOT NULL DEFAULT 0,
  "processedSessions" INTEGER NOT NULL DEFAULT 0,
  "completedSessions" INTEGER NOT NULL DEFAULT 0,
  "failedSessions" INTEGER NOT NULL DEFAULT 0,
  "skippedSessions" INTEGER NOT NULL DEFAULT 0,
  "totalChats" INTEGER NOT NULL DEFAULT 0,
  "processedChats" INTEGER NOT NULL DEFAULT 0,
  "draftedChats" INTEGER NOT NULL DEFAULT 0,
  "filteredChats" INTEGER NOT NULL DEFAULT 0,
  "failedChats" INTEGER NOT NULL DEFAULT 0,
  "cancelRequested" BOOLEAN NOT NULL DEFAULT false,
  "metadata" JSONB,
  "errorMessage" TEXT,
  "startedAt" TIMESTAMP(3),
  "finishedAt" TIMESTAMP(3),
  "lastProgressAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "TelegramDraftJob_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "TelegramDraftSessionJob" (
  "id" TEXT NOT NULL,
  "draftJobId" TEXT NOT NULL,
  "sessionId" TEXT,
  "sessionLabel" VARCHAR(160) NOT NULL,
  "status" VARCHAR(20) NOT NULL DEFAULT 'pending',
  "position" INTEGER NOT NULL DEFAULT 0,
  "totalChats" INTEGER NOT NULL DEFAULT 0,
  "processedChats" INTEGER NOT NULL DEFAULT 0,
  "draftedChats" INTEGER NOT NULL DEFAULT 0,
  "filteredChats" INTEGER NOT NULL DEFAULT 0,
  "failedChats" INTEGER NOT NULL DEFAULT 0,
  "currentChatTitle" VARCHAR(255),
  "result" JSONB,
  "errorCode" VARCHAR(100),
  "errorMessage" TEXT,
  "attempts" INTEGER NOT NULL DEFAULT 0,
  "claimedAt" TIMESTAMP(3),
  "finishedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "TelegramDraftSessionJob_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "TelegramDraftResult" (
  "id" TEXT NOT NULL,
  "draftJobId" TEXT NOT NULL,
  "draftSessionJobId" TEXT NOT NULL,
  "chatId" BIGINT NOT NULL,
  "chatTitle" VARCHAR(255) NOT NULL,
  "chatUsername" VARCHAR(100),
  "chatType" VARCHAR(30) NOT NULL,
  "status" VARCHAR(20) NOT NULL,
  "matchedFilter" VARCHAR(100),
  "inspectedMessages" INTEGER NOT NULL DEFAULT 0,
  "errorCode" VARCHAR(100),
  "errorMessage" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "TelegramDraftResult_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "TelegramDraftJob_accountId_createdAt_idx" ON "TelegramDraftJob"("accountId", "createdAt");
CREATE INDEX "TelegramDraftJob_status_createdAt_idx" ON "TelegramDraftJob"("status", "createdAt");
CREATE UNIQUE INDEX "TelegramDraftSessionJob_draftJobId_sessionId_key" ON "TelegramDraftSessionJob"("draftJobId", "sessionId");
CREATE INDEX "TelegramDraftSessionJob_status_createdAt_idx" ON "TelegramDraftSessionJob"("status", "createdAt");
CREATE INDEX "TelegramDraftSessionJob_draftJobId_status_position_idx" ON "TelegramDraftSessionJob"("draftJobId", "status", "position");
CREATE INDEX "TelegramDraftSessionJob_sessionId_createdAt_idx" ON "TelegramDraftSessionJob"("sessionId", "createdAt");
CREATE UNIQUE INDEX "TelegramDraftResult_draftSessionJobId_chatId_key" ON "TelegramDraftResult"("draftSessionJobId", "chatId");
CREATE INDEX "TelegramDraftResult_draftJobId_status_createdAt_idx" ON "TelegramDraftResult"("draftJobId", "status", "createdAt");
CREATE INDEX "TelegramDraftResult_draftSessionJobId_createdAt_idx" ON "TelegramDraftResult"("draftSessionJobId", "createdAt");

ALTER TABLE "TelegramDraftJob" ADD CONSTRAINT "TelegramDraftJob_accountId_fkey"
  FOREIGN KEY ("accountId") REFERENCES "ValidatorAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TelegramDraftSessionJob" ADD CONSTRAINT "TelegramDraftSessionJob_draftJobId_fkey"
  FOREIGN KEY ("draftJobId") REFERENCES "TelegramDraftJob"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TelegramDraftSessionJob" ADD CONSTRAINT "TelegramDraftSessionJob_sessionId_fkey"
  FOREIGN KEY ("sessionId") REFERENCES "TelegramSession"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "TelegramDraftResult" ADD CONSTRAINT "TelegramDraftResult_draftJobId_fkey"
  FOREIGN KEY ("draftJobId") REFERENCES "TelegramDraftJob"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TelegramDraftResult" ADD CONSTRAINT "TelegramDraftResult_draftSessionJobId_fkey"
  FOREIGN KEY ("draftSessionJobId") REFERENCES "TelegramDraftSessionJob"("id") ON DELETE CASCADE ON UPDATE CASCADE;
