ALTER TABLE "TelegramSession"
  ADD COLUMN "profileBio" VARCHAR(255),
  ADD COLUMN "avatarData" BYTEA,
  ADD COLUMN "avatarMime" VARCHAR(50),
  ADD COLUMN "isPremium" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "isVerified" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "isRestricted" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "profileSyncedAt" TIMESTAMP(3),
  ADD COLUMN "profileSyncRequested" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN "profileSyncClaimedAt" TIMESTAMP(3);

CREATE INDEX "TelegramSession_profileSyncRequested_profileSyncClaimedAt_idx"
  ON "TelegramSession"("profileSyncRequested", "profileSyncClaimedAt");
