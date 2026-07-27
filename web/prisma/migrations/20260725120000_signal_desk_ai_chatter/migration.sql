-- Durable AI Chatter settings, encrypted provider credentials, memory, jobs, and audit logs.
CREATE TABLE "AiAccountSetting" (
  "id" TEXT NOT NULL,
  "accountId" TEXT NOT NULL,
  "enabled" BOOLEAN NOT NULL DEFAULT false,
  "reengageEnabled" BOOLEAN NOT NULL DEFAULT true,
  "config" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "AiAccountSetting_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "AiProviderCredential" (
  "id" TEXT NOT NULL,
  "accountId" TEXT NOT NULL,
  "provider" VARCHAR(30) NOT NULL,
  "secretEncrypted" TEXT NOT NULL,
  "isValid" BOOLEAN NOT NULL DEFAULT false,
  "modelId" INTEGER,
  "presetId" INTEGER,
  "catalog" JSONB,
  "lastValidatedAt" TIMESTAMP(3),
  "validationError" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "AiProviderCredential_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "AiSessionSetting" (
  "id" TEXT NOT NULL,
  "accountId" TEXT NOT NULL,
  "sessionId" TEXT NOT NULL,
  "enabled" BOOLEAN NOT NULL DEFAULT false,
  "config" JSONB,
  "runtimeStatus" VARCHAR(30) NOT NULL DEFAULT 'stopped',
  "lastConnectedAt" TIMESTAMP(3),
  "lastHeartbeatAt" TIMESTAMP(3),
  "lastError" TEXT,
  "catchupRequested" BOOLEAN NOT NULL DEFAULT false,
  "catchupClaimedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "AiSessionSetting_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "AiChatSetting" (
  "id" TEXT NOT NULL,
  "accountId" TEXT NOT NULL,
  "sessionId" TEXT NOT NULL,
  "peerId" BIGINT NOT NULL,
  "enabled" BOOLEAN NOT NULL DEFAULT true,
  "config" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "AiChatSetting_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "AiChatMemory" (
  "id" TEXT NOT NULL,
  "accountId" TEXT NOT NULL,
  "sessionId" TEXT NOT NULL,
  "peerId" BIGINT NOT NULL,
  "recipient" JSONB,
  "messages" JSONB NOT NULL,
  "conversationState" VARCHAR(30) NOT NULL DEFAULT 'active',
  "lastCategory" VARCHAR(80),
  "reengage" JSONB,
  "lastIncomingAt" TIMESTAMP(3),
  "lastOutgoingAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "AiChatMemory_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "AiChatJob" (
  "id" TEXT NOT NULL,
  "accountId" TEXT NOT NULL,
  "sessionId" TEXT NOT NULL,
  "peerId" BIGINT NOT NULL,
  "incomingMsgId" BIGINT,
  "status" VARCHAR(30) NOT NULL DEFAULT 'pending',
  "attempts" INTEGER NOT NULL DEFAULT 0,
  "maxAttempts" INTEGER NOT NULL DEFAULT 3,
  "isFollowUp" BOOLEAN NOT NULL DEFAULT false,
  "requestPayload" JSONB,
  "resultPayload" JSONB,
  "errorCode" VARCHAR(100),
  "errorMessage" TEXT,
  "runAfter" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "claimedAt" TIMESTAMP(3),
  "finishedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "AiChatJob_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "AiResponseLog" (
  "id" TEXT NOT NULL,
  "accountId" TEXT NOT NULL,
  "sessionId" TEXT NOT NULL,
  "jobId" TEXT,
  "peerId" BIGINT NOT NULL,
  "incomingMsgId" BIGINT,
  "outgoingMsgId" BIGINT,
  "provider" VARCHAR(30) NOT NULL,
  "status" VARCHAR(30) NOT NULL,
  "category" VARCHAR(80),
  "incomingText" TEXT,
  "responseText" TEXT,
  "isFollowUp" BOOLEAN NOT NULL DEFAULT false,
  "didConvert" BOOLEAN NOT NULL DEFAULT false,
  "errorCode" VARCHAR(100),
  "errorMessage" TEXT,
  "providerMeta" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AiResponseLog_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "AiAccountSetting_accountId_key" ON "AiAccountSetting"("accountId");
CREATE UNIQUE INDEX "AiProviderCredential_accountId_provider_key" ON "AiProviderCredential"("accountId", "provider");
CREATE INDEX "AiProviderCredential_accountId_updatedAt_idx" ON "AiProviderCredential"("accountId", "updatedAt");
CREATE UNIQUE INDEX "AiSessionSetting_sessionId_key" ON "AiSessionSetting"("sessionId");
CREATE INDEX "AiSessionSetting_accountId_enabled_idx" ON "AiSessionSetting"("accountId", "enabled");
CREATE INDEX "AiSessionSetting_enabled_runtimeStatus_idx" ON "AiSessionSetting"("enabled", "runtimeStatus");
CREATE INDEX "AiSessionSetting_catchupRequested_catchupClaimedAt_idx" ON "AiSessionSetting"("catchupRequested", "catchupClaimedAt");
CREATE UNIQUE INDEX "AiChatSetting_sessionId_peerId_key" ON "AiChatSetting"("sessionId", "peerId");
CREATE INDEX "AiChatSetting_accountId_updatedAt_idx" ON "AiChatSetting"("accountId", "updatedAt");
CREATE UNIQUE INDEX "AiChatMemory_sessionId_peerId_key" ON "AiChatMemory"("sessionId", "peerId");
CREATE INDEX "AiChatMemory_accountId_updatedAt_idx" ON "AiChatMemory"("accountId", "updatedAt");
CREATE INDEX "AiChatMemory_sessionId_updatedAt_idx" ON "AiChatMemory"("sessionId", "updatedAt");
CREATE UNIQUE INDEX "AiChatJob_sessionId_incomingMsgId_key" ON "AiChatJob"("sessionId", "incomingMsgId");
CREATE INDEX "AiChatJob_status_runAfter_createdAt_idx" ON "AiChatJob"("status", "runAfter", "createdAt");
CREATE INDEX "AiChatJob_accountId_createdAt_idx" ON "AiChatJob"("accountId", "createdAt");
CREATE INDEX "AiChatJob_sessionId_peerId_createdAt_idx" ON "AiChatJob"("sessionId", "peerId", "createdAt");
CREATE INDEX "AiResponseLog_accountId_createdAt_idx" ON "AiResponseLog"("accountId", "createdAt");
CREATE INDEX "AiResponseLog_sessionId_peerId_createdAt_idx" ON "AiResponseLog"("sessionId", "peerId", "createdAt");
CREATE INDEX "AiResponseLog_status_createdAt_idx" ON "AiResponseLog"("status", "createdAt");

ALTER TABLE "AiAccountSetting" ADD CONSTRAINT "AiAccountSetting_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "ValidatorAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AiProviderCredential" ADD CONSTRAINT "AiProviderCredential_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "ValidatorAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AiSessionSetting" ADD CONSTRAINT "AiSessionSetting_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "ValidatorAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AiSessionSetting" ADD CONSTRAINT "AiSessionSetting_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "TelegramSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AiChatSetting" ADD CONSTRAINT "AiChatSetting_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "ValidatorAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AiChatSetting" ADD CONSTRAINT "AiChatSetting_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "TelegramSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AiChatMemory" ADD CONSTRAINT "AiChatMemory_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "ValidatorAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AiChatMemory" ADD CONSTRAINT "AiChatMemory_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "TelegramSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AiChatJob" ADD CONSTRAINT "AiChatJob_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "ValidatorAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AiChatJob" ADD CONSTRAINT "AiChatJob_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "TelegramSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AiResponseLog" ADD CONSTRAINT "AiResponseLog_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "ValidatorAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AiResponseLog" ADD CONSTRAINT "AiResponseLog_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "TelegramSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;
