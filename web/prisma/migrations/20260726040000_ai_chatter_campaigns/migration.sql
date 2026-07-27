-- Campaign-owned AI credentials, runtime leases, and isolated conversation data.
CREATE TABLE "AiCampaign" (
  "id" TEXT NOT NULL,
  "accountId" TEXT NOT NULL,
  "name" VARCHAR(160) NOT NULL,
  "provider" VARCHAR(30) NOT NULL,
  "secretEncrypted" TEXT NOT NULL,
  "credentialValid" BOOLEAN NOT NULL DEFAULT true,
  "modelId" INTEGER,
  "presetId" INTEGER,
  "catalog" JSONB,
  "config" JSONB NOT NULL,
  "reengageEnabled" BOOLEAN NOT NULL DEFAULT true,
  "durationMode" VARCHAR(30) NOT NULL DEFAULT 'until_stopped',
  "status" VARCHAR(30) NOT NULL DEFAULT 'starting',
  "messagesReceived" INTEGER NOT NULL DEFAULT 0,
  "messagesSent" INTEGER NOT NULL DEFAULT 0,
  "failedCount" INTEGER NOT NULL DEFAULT 0,
  "creditsUsed" INTEGER NOT NULL DEFAULT 0,
  "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "endsAt" TIMESTAMP(3),
  "stoppedAt" TIMESTAMP(3),
  "creditGraceStartedAt" TIMESTAMP(3),
  "creditGraceEndsAt" TIMESTAMP(3),
  "lastError" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AiCampaign_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "AiCampaignSession" (
  "id" TEXT NOT NULL,
  "campaignId" TEXT NOT NULL,
  "sessionId" TEXT NOT NULL,
  "activeSessionId" TEXT,
  "position" INTEGER NOT NULL DEFAULT 0,
  "runtimeStatus" VARCHAR(30) NOT NULL DEFAULT 'starting',
  "lastConnectedAt" TIMESTAMP(3),
  "lastHeartbeatAt" TIMESTAMP(3),
  "lastError" TEXT,
  "catchupRequested" BOOLEAN NOT NULL DEFAULT true,
  "catchupClaimedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AiCampaignSession_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "AiChatSetting" ADD COLUMN "campaignId" TEXT;
ALTER TABLE "AiChatMemory" ADD COLUMN "campaignId" TEXT;
ALTER TABLE "AiChatJob" ADD COLUMN "campaignId" TEXT;
ALTER TABLE "AiResponseLog" ADD COLUMN "campaignId" TEXT;

-- Preserve the existing global setup as one campaign per configured workspace.
INSERT INTO "AiCampaign" (
  "id", "accountId", "name", "provider", "secretEncrypted", "credentialValid",
  "modelId", "presetId", "catalog", "config", "reengageEnabled", "durationMode",
  "status", "startedAt", "createdAt", "updatedAt"
)
SELECT
  'aic_legacy_' || md5(a."accountId"), a."accountId", 'Legacy AI Chatter',
  COALESCE(a.config->>'provider', 'capitalbot'), p."secretEncrypted", p."isValid",
  p."modelId", p."presetId", p.catalog, COALESCE(a.config, '{}'::jsonb),
  a."reengageEnabled", 'until_stopped',
  CASE WHEN a.enabled THEN 'running' ELSE 'stopped' END,
  a."createdAt", a."createdAt", CURRENT_TIMESTAMP
FROM "AiAccountSetting" a
JOIN "AiProviderCredential" p
  ON p."accountId" = a."accountId"
 AND p.provider = COALESCE(a.config->>'provider', 'capitalbot')
ON CONFLICT DO NOTHING;

INSERT INTO "AiCampaignSession" (
  "id", "campaignId", "sessionId", "activeSessionId", "position", "runtimeStatus",
  "lastConnectedAt", "lastHeartbeatAt", "lastError", "catchupRequested",
  "catchupClaimedAt", "createdAt", "updatedAt"
)
SELECT
  'aics_legacy_' || md5(s.id), c.id, s."sessionId",
  CASE WHEN c.status = 'running' AND s.enabled THEN s."sessionId" ELSE NULL END,
  (row_number() OVER (PARTITION BY c.id ORDER BY s."createdAt") - 1)::integer,
  CASE WHEN c.status = 'running' AND s.enabled THEN s."runtimeStatus" ELSE 'stopped' END,
  s."lastConnectedAt", s."lastHeartbeatAt", s."lastError", s."catchupRequested",
  s."catchupClaimedAt", s."createdAt", CURRENT_TIMESTAMP
FROM "AiSessionSetting" s
JOIN "AiCampaign" c ON c."accountId" = s."accountId"
WHERE s.enabled = true OR EXISTS (
  SELECT 1 FROM "AiChatMemory" m WHERE m."sessionId" = s."sessionId"
)
ON CONFLICT DO NOTHING;

UPDATE "AiChatSetting" value SET "campaignId" = campaign.id
FROM "AiCampaign" campaign WHERE campaign."accountId" = value."accountId";
UPDATE "AiChatMemory" value SET "campaignId" = campaign.id
FROM "AiCampaign" campaign WHERE campaign."accountId" = value."accountId";
UPDATE "AiChatJob" value SET "campaignId" = campaign.id
FROM "AiCampaign" campaign WHERE campaign."accountId" = value."accountId";
UPDATE "AiResponseLog" value SET "campaignId" = campaign.id
FROM "AiCampaign" campaign WHERE campaign."accountId" = value."accountId";

ALTER TABLE "AiChatSetting" ALTER COLUMN "campaignId" SET NOT NULL;
ALTER TABLE "AiChatMemory" ALTER COLUMN "campaignId" SET NOT NULL;
ALTER TABLE "AiChatJob" ALTER COLUMN "campaignId" SET NOT NULL;
ALTER TABLE "AiResponseLog" ALTER COLUMN "campaignId" SET NOT NULL;

UPDATE "AiAccountSetting" SET enabled = false;
UPDATE "AiSessionSetting" SET enabled = false, "runtimeStatus" = 'stopped';

DROP INDEX "AiChatSetting_sessionId_peerId_key";
DROP INDEX "AiChatMemory_sessionId_peerId_key";
DROP INDEX "AiChatJob_sessionId_incomingMsgId_key";

CREATE UNIQUE INDEX "AiCampaignSession_activeSessionId_key" ON "AiCampaignSession"("activeSessionId");
CREATE UNIQUE INDEX "AiCampaignSession_campaignId_sessionId_key" ON "AiCampaignSession"("campaignId", "sessionId");
CREATE UNIQUE INDEX "AiChatSetting_campaignId_sessionId_peerId_key" ON "AiChatSetting"("campaignId", "sessionId", "peerId");
CREATE UNIQUE INDEX "AiChatMemory_campaignId_sessionId_peerId_key" ON "AiChatMemory"("campaignId", "sessionId", "peerId");
CREATE UNIQUE INDEX "AiChatJob_campaignId_sessionId_incomingMsgId_key" ON "AiChatJob"("campaignId", "sessionId", "incomingMsgId");
CREATE INDEX "AiCampaign_accountId_createdAt_idx" ON "AiCampaign"("accountId", "createdAt");
CREATE INDEX "AiCampaign_status_endsAt_idx" ON "AiCampaign"("status", "endsAt");
CREATE INDEX "AiCampaign_accountId_status_idx" ON "AiCampaign"("accountId", "status");
CREATE INDEX "AiCampaign_creditGraceEndsAt_idx" ON "AiCampaign"("creditGraceEndsAt");
CREATE INDEX "AiCampaignSession_campaignId_position_idx" ON "AiCampaignSession"("campaignId", "position");
CREATE INDEX "AiCampaignSession_sessionId_createdAt_idx" ON "AiCampaignSession"("sessionId", "createdAt");
CREATE INDEX "AiCampaignSession_runtimeStatus_lastHeartbeatAt_idx" ON "AiCampaignSession"("runtimeStatus", "lastHeartbeatAt");
CREATE INDEX "AiChatMemory_campaignId_updatedAt_idx" ON "AiChatMemory"("campaignId", "updatedAt");
CREATE INDEX "AiChatJob_campaignId_status_runAfter_idx" ON "AiChatJob"("campaignId", status, "runAfter");
CREATE INDEX "AiResponseLog_campaignId_createdAt_idx" ON "AiResponseLog"("campaignId", "createdAt");

ALTER TABLE "AiCampaign" ADD CONSTRAINT "AiCampaign_accountId_fkey"
  FOREIGN KEY ("accountId") REFERENCES "ValidatorAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AiCampaignSession" ADD CONSTRAINT "AiCampaignSession_campaignId_fkey"
  FOREIGN KEY ("campaignId") REFERENCES "AiCampaign"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AiCampaignSession" ADD CONSTRAINT "AiCampaignSession_sessionId_fkey"
  FOREIGN KEY ("sessionId") REFERENCES "TelegramSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AiChatSetting" ADD CONSTRAINT "AiChatSetting_campaignId_fkey"
  FOREIGN KEY ("campaignId") REFERENCES "AiCampaign"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AiChatMemory" ADD CONSTRAINT "AiChatMemory_campaignId_fkey"
  FOREIGN KEY ("campaignId") REFERENCES "AiCampaign"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AiChatJob" ADD CONSTRAINT "AiChatJob_campaignId_fkey"
  FOREIGN KEY ("campaignId") REFERENCES "AiCampaign"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AiResponseLog" ADD CONSTRAINT "AiResponseLog_campaignId_fkey"
  FOREIGN KEY ("campaignId") REFERENCES "AiCampaign"("id") ON DELETE CASCADE ON UPDATE CASCADE;
