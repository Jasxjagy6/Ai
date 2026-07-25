INSERT INTO "ValidatorCreditTransaction" (
  "id",
  "accountId",
  "amount",
  "balanceAfter",
  "kind",
  "description",
  "referenceType",
  "referenceId",
  "createdAt"
)
SELECT
  'compat_' || MD5(account.id),
  account.id,
  2500,
  2500,
  'compatibility_grant',
  'Signal Desk credit migration grant',
  'migration',
  '20260724090000_validator_credits_affiliates',
  migration.finished_at
FROM "ValidatorAccount" account
CROSS JOIN LATERAL (
  SELECT finished_at
  FROM "_prisma_migrations"
  WHERE migration_name = '20260724090000_validator_credits_affiliates'
    AND finished_at IS NOT NULL
  ORDER BY finished_at DESC
  LIMIT 1
) migration
WHERE account."createdAt" < migration.finished_at
  AND account."creditsPurchased" >= 2500
  AND NOT EXISTS (
    SELECT 1
    FROM "ValidatorCreditTransaction" tx
    WHERE tx."accountId" = account.id
      AND tx.kind = 'compatibility_grant'
  );
