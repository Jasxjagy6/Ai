ALTER TABLE "TelegramCampaignSession" DROP CONSTRAINT "TelegramCampaignSession_sessionId_fkey";

ALTER TABLE "TelegramCampaignSession" ADD CONSTRAINT "TelegramCampaignSession_sessionId_fkey"
FOREIGN KEY ("sessionId") REFERENCES "TelegramSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;
