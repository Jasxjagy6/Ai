CREATE TABLE "TelegramClientCommand" (
    "id" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "kind" VARCHAR(50) NOT NULL,
    "status" VARCHAR(20) NOT NULL DEFAULT 'pending',
    "payload" JSONB,
    "result" JSONB,
    "resultData" BYTEA,
    "resultMime" VARCHAR(100),
    "resultName" VARCHAR(255),
    "errorCode" VARCHAR(100),
    "errorMessage" TEXT,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "claimedAt" TIMESTAMP(3),
    "finishedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TelegramClientCommand_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "TelegramClientCommand_status_createdAt_idx" ON "TelegramClientCommand"("status", "createdAt");
CREATE INDEX "TelegramClientCommand_accountId_sessionId_createdAt_idx" ON "TelegramClientCommand"("accountId", "sessionId", "createdAt");
CREATE INDEX "TelegramClientCommand_expiresAt_idx" ON "TelegramClientCommand"("expiresAt");

ALTER TABLE "TelegramClientCommand" ADD CONSTRAINT "TelegramClientCommand_accountId_fkey"
  FOREIGN KEY ("accountId") REFERENCES "ValidatorAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "TelegramClientCommand" ADD CONSTRAINT "TelegramClientCommand_sessionId_fkey"
  FOREIGN KEY ("sessionId") REFERENCES "TelegramSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;
