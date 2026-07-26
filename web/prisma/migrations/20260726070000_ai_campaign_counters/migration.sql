-- Preserve legacy AI analytics in the campaign landing cards after ownership migration.
UPDATE "AiCampaign" campaign SET
  "messagesReceived" = COALESCE((
    SELECT SUM(incoming.count)::integer
    FROM (
      SELECT COUNT(*) FILTER (WHERE item->>'isIncoming' = 'true') AS count
      FROM "AiChatMemory" memory,
        LATERAL jsonb_array_elements(memory.messages) AS item
      WHERE memory."campaignId" = campaign.id
      GROUP BY memory.id
    ) incoming
  ), 0),
  "messagesSent" = COALESCE((
    SELECT COUNT(*)::integer FROM "AiResponseLog" log
    WHERE log."campaignId" = campaign.id AND log.status = 'sent'
  ), 0),
  "failedCount" = COALESCE((
    SELECT COUNT(*)::integer FROM "AiResponseLog" log
    WHERE log."campaignId" = campaign.id AND log.status = 'failed'
  ), 0),
  "creditsUsed" = COALESCE((
    SELECT COUNT(*)::integer * 5 FROM "AiResponseLog" log
    WHERE log."campaignId" = campaign.id AND log.status = 'sent'
  ), 0),
  "updatedAt" = NOW();
