-- Admin-issued validator access, contact-list management, and durable sessionless t.me filtering.
CREATE TABLE "ValidatorAccount" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "ValidatorAccount_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ValidatorAccessKey" (
    "id" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "createdById" TEXT,
    "label" VARCHAR(80) NOT NULL DEFAULT 'Primary key',
    "keyHash" TEXT NOT NULL,
    "prefix" VARCHAR(24) NOT NULL,
    "revoked" BOOLEAN NOT NULL DEFAULT false,
    "expiresAt" TIMESTAMP(3),
    "lastUsedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ValidatorAccessKey_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ValidatorSession" (
    "id" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ValidatorSession_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ContactList" (
    "id" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "type" VARCHAR(20) NOT NULL DEFAULT 'users',
    "itemsCount" INTEGER NOT NULL DEFAULT 0,
    "source" VARCHAR(100),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "ContactList_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ListItem" (
    "id" TEXT NOT NULL,
    "listId" TEXT NOT NULL,
    "telegramId" BIGINT,
    "username" VARCHAR(100),
    "firstName" VARCHAR(100),
    "lastName" VARCHAR(100),
    "phone" VARCHAR(30),
    "accessHash" BIGINT,
    "bio" VARCHAR(70),
    "addedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ListItem_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "LinkFilterJob" (
    "id" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "sourceListId" TEXT,
    "resultListId" TEXT,
    "sourceListName" VARCHAR(255) NOT NULL,
    "resultListName" VARCHAR(255) NOT NULL,
    "status" VARCHAR(20) NOT NULL DEFAULT 'pending',
    "sourceItemsCount" INTEGER NOT NULL DEFAULT 0,
    "totalCount" INTEGER NOT NULL DEFAULT 0,
    "processedCount" INTEGER NOT NULL DEFAULT 0,
    "validCount" INTEGER NOT NULL DEFAULT 0,
    "invalidCount" INTEGER NOT NULL DEFAULT 0,
    "failedCount" INTEGER NOT NULL DEFAULT 0,
    "skippedCount" INTEGER NOT NULL DEFAULT 0,
    "ignoredCount" INTEGER NOT NULL DEFAULT 0,
    "duplicateCount" INTEGER NOT NULL DEFAULT 0,
    "currentUsername" VARCHAR(100),
    "currentPass" INTEGER NOT NULL DEFAULT 0,
    "maxPasses" INTEGER NOT NULL DEFAULT 1,
    "passProcessedCount" INTEGER NOT NULL DEFAULT 0,
    "passTotalCount" INTEGER NOT NULL DEFAULT 0,
    "totalRequests" INTEGER NOT NULL DEFAULT 0,
    "timedOut" BOOLEAN NOT NULL DEFAULT false,
    "cancelRequested" BOOLEAN NOT NULL DEFAULT false,
    "errorMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "startedAt" TIMESTAMP(3),
    "finishedAt" TIMESTAMP(3),
    "lastProgressAt" TIMESTAMP(3),
    CONSTRAINT "LinkFilterJob_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "LinkFilterItem" (
    "id" TEXT NOT NULL,
    "jobId" TEXT NOT NULL,
    "sourceListItemId" TEXT,
    "username" VARCHAR(100) NOT NULL,
    "normalizedUsername" VARCHAR(100) NOT NULL,
    "status" VARCHAR(20) NOT NULL DEFAULT 'pending',
    "displayName" VARCHAR(100),
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "errorCode" VARCHAR(80),
    "errorMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "startedAt" TIMESTAMP(3),
    "finishedAt" TIMESTAMP(3),
    CONSTRAINT "LinkFilterItem_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ValidatorAccount_email_key" ON "ValidatorAccount"("email");
CREATE UNIQUE INDEX "ValidatorAccessKey_keyHash_key" ON "ValidatorAccessKey"("keyHash");
CREATE INDEX "ValidatorAccessKey_accountId_createdAt_idx" ON "ValidatorAccessKey"("accountId", "createdAt");
CREATE UNIQUE INDEX "ValidatorSession_tokenHash_key" ON "ValidatorSession"("tokenHash");
CREATE INDEX "ValidatorSession_accountId_expiresAt_idx" ON "ValidatorSession"("accountId", "expiresAt");
CREATE INDEX "ValidatorSession_expiresAt_idx" ON "ValidatorSession"("expiresAt");
CREATE INDEX "ContactList_accountId_createdAt_idx" ON "ContactList"("accountId", "createdAt");
CREATE INDEX "ListItem_listId_addedAt_idx" ON "ListItem"("listId", "addedAt");
CREATE INDEX "ListItem_listId_telegramId_idx" ON "ListItem"("listId", "telegramId");
CREATE INDEX "ListItem_listId_username_idx" ON "ListItem"("listId", "username");
CREATE INDEX "LinkFilterJob_accountId_createdAt_idx" ON "LinkFilterJob"("accountId", "createdAt");
CREATE INDEX "LinkFilterJob_status_createdAt_idx" ON "LinkFilterJob"("status", "createdAt");
CREATE UNIQUE INDEX "LinkFilterJob_accountId_active_key" ON "LinkFilterJob"("accountId") WHERE "status" IN ('pending', 'running');
CREATE UNIQUE INDEX "LinkFilterItem_jobId_normalizedUsername_key" ON "LinkFilterItem"("jobId", "normalizedUsername");
CREATE INDEX "LinkFilterItem_jobId_status_createdAt_idx" ON "LinkFilterItem"("jobId", "status", "createdAt");

ALTER TABLE "ValidatorAccessKey" ADD CONSTRAINT "ValidatorAccessKey_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "ValidatorAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ValidatorAccessKey" ADD CONSTRAINT "ValidatorAccessKey_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ValidatorSession" ADD CONSTRAINT "ValidatorSession_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "ValidatorAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ContactList" ADD CONSTRAINT "ContactList_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "ValidatorAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ListItem" ADD CONSTRAINT "ListItem_listId_fkey" FOREIGN KEY ("listId") REFERENCES "ContactList"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "LinkFilterJob" ADD CONSTRAINT "LinkFilterJob_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "ValidatorAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "LinkFilterJob" ADD CONSTRAINT "LinkFilterJob_sourceListId_fkey" FOREIGN KEY ("sourceListId") REFERENCES "ContactList"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "LinkFilterJob" ADD CONSTRAINT "LinkFilterJob_resultListId_fkey" FOREIGN KEY ("resultListId") REFERENCES "ContactList"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "LinkFilterItem" ADD CONSTRAINT "LinkFilterItem_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "LinkFilterJob"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "LinkFilterItem" ADD CONSTRAINT "LinkFilterItem_sourceListItemId_fkey" FOREIGN KEY ("sourceListItemId") REFERENCES "ListItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;
