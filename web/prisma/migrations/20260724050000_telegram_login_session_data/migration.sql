-- Persist the unauthenticated MTProto auth key between the code and 2FA steps.
ALTER TABLE "TelegramLoginFlow"
ADD COLUMN "accessKeyId" TEXT,
ADD COLUMN "sessionDataEncrypted" TEXT;

CREATE INDEX "TelegramLoginFlow_accessKeyId_idx" ON "TelegramLoginFlow"("accessKeyId");

ALTER TABLE "TelegramLoginFlow" ADD CONSTRAINT "TelegramLoginFlow_accessKeyId_fkey"
FOREIGN KEY ("accessKeyId") REFERENCES "ValidatorAccessKey"("id") ON DELETE SET NULL ON UPDATE CASCADE;
