CREATE INDEX IF NOT EXISTS "LinkFilterItem_sourceListItemId_idx"
  ON "LinkFilterItem"("sourceListItemId");

CREATE INDEX IF NOT EXISTS "LinkFilterJob_sourceListId_idx"
  ON "LinkFilterJob"("sourceListId");

CREATE INDEX IF NOT EXISTS "LinkFilterJob_resultListId_idx"
  ON "LinkFilterJob"("resultListId");

CREATE INDEX IF NOT EXISTS "TelegramCampaign_sourceListId_idx"
  ON "TelegramCampaign"("sourceListId");

CREATE INDEX IF NOT EXISTS "TelegramMessageSchedule_sourceListId_idx"
  ON "TelegramMessageSchedule"("sourceListId");
