ALTER TABLE "ValidatorAccessKey" ADD COLUMN "rawKeyEncrypted" TEXT;
ALTER TABLE "ValidatorAffiliateReward" ADD COLUMN "rewardDays" INTEGER NOT NULL DEFAULT 0;

UPDATE "ValidatorAccount"
SET "currentPlanCode" = CASE
  WHEN "currentPlanCode" = 'trial' THEN 'trial'
  ELSE 'month'
END,
"planExpiresAt" = COALESCE("planExpiresAt", NOW() + INTERVAL '30 days'),
"creditsBalance" = 0,
"creditsPurchased" = 0,
"creditsSpent" = 0,
"lastCreditTopupAt" = NULL;

UPDATE "ValidatorAccessKey"
SET "planCode" = CASE WHEN "planCode" = 'trial' THEN 'trial' ELSE 'month' END,
"expiresAt" = NULL,
"validatorAccess" = TRUE,
"messagingAccess" = TRUE,
"requestLimit" = NULL,
"sessionLimit" = NULL,
"messageLimit" = NULL;

UPDATE "ValidatorSession"
SET "expiresAt" = GREATEST("expiresAt", NOW() + INTERVAL '10 years');

UPDATE "AiCampaign"
SET status = 'running',
"creditGraceStartedAt" = NULL,
"creditGraceEndsAt" = NULL,
"lastError" = NULL
WHERE status = 'credit_grace';
