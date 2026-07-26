import AdmZip from "adm-zip";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireSignalDeskAccount } from "@/lib/validator-auth";
import { unauthorized } from "@/lib/validator-api";

const csvCell = (value: unknown) => `"${String(value ?? "").replaceAll('"', '""')}"`;
const csvFile = (headers: string[], rows: unknown[][]) =>
  [headers, ...rows].map((row) => row.map(csvCell).join(",")).join("\r\n");

function reportRange(request: Request) {
  const url = new URL(request.url);
  const fromValue = url.searchParams.get("from");
  const toValue = url.searchParams.get("to");
  const createdAt: Prisma.DateTimeFilter = {};
  if (fromValue) createdAt.gte = new Date(fromValue);
  if (toValue) createdAt.lte = new Date(toValue);
  return { fromValue, toValue, createdAt: fromValue || toValue ? createdAt : undefined };
}

export async function GET(request: Request) {
  const account = await requireSignalDeskAccount();
  if (!account) return unauthorized();
  const range = reportRange(request);
  const where = { accountId: account.id, ...(range.createdAt ? { createdAt: range.createdAt } : {}) };
  const [validation, campaigns, accountBatches, aiCampaigns] = await Promise.all([
    prisma.linkFilterJob.findMany({ where, orderBy: { createdAt: "desc" }, include: { items: true } }),
    prisma.telegramCampaign.findMany({ where, orderBy: { createdAt: "desc" }, include: { sessions: { include: { session: true } }, recipients: true } }),
    prisma.telegramAccountSettingsBatch.findMany({ where, orderBy: { createdAt: "desc" }, include: { jobs: { include: { session: true } } } }),
    prisma.aiCampaign.findMany({ where, orderBy: { createdAt: "desc" }, include: { sessions: { include: { session: true } }, memories: true, jobs: true, responseLogs: true } }),
  ]);
  const zip = new AdmZip();
  const generatedAt = new Date().toISOString();
  const allRunCount = validation.length + campaigns.length + accountBatches.length + aiCampaigns.length;
  zip.addFile("README.txt", Buffer.from([
    "Signal Desk comprehensive workspace report",
    `Workspace: ${account.email}`,
    `Generated: ${generatedAt}`,
    `Range start: ${range.fromValue || "All time"}`,
    `Range end: ${range.toValue || "Now"}`,
    `Total runs: ${allRunCount}`,
    "",
    "Files are separated by operation type. ID columns connect summary rows to detailed result rows.",
    "Sensitive access keys, provider credentials, Telegram session data, and encrypted fields are never exported.",
  ].join("\r\n")));
  zip.addFile("summary.csv", Buffer.from(csvFile(
    ["workspace", "generated_at", "range_from", "range_to", "validation_runs", "telegram_campaigns", "account_operations", "ai_campaigns", "total_runs", "credits_balance", "credits_spent"],
    [[account.email, generatedAt, range.fromValue, range.toValue, validation.length, campaigns.length, accountBatches.length, aiCampaigns.length, allRunCount, account.creditsBalance, account.creditsSpent]],
  )));
  zip.addFile("validation_runs.csv", Buffer.from(csvFile(
    ["run_id", "status", "source_list", "result_list", "source_rows", "total", "processed", "valid", "invalid", "failed", "skipped", "ignored", "duplicates", "requests", "passes", "timed_out", "used_proxies", "created_at", "started_at", "finished_at", "error"],
    validation.map((run) => [run.id, run.status, run.sourceListName, run.resultListName, run.sourceItemsCount, run.totalCount, run.processedCount, run.validCount, run.invalidCount, run.failedCount, run.skippedCount, run.ignoredCount, run.duplicateCount, run.totalRequests, run.maxPasses, run.timedOut, run.useProxies, run.createdAt.toISOString(), run.startedAt?.toISOString(), run.finishedAt?.toISOString(), run.errorMessage]),
  )));
  zip.addFile("validation_rows.csv", Buffer.from(csvFile(
    ["run_id", "username", "status", "display_name", "attempts", "error_code", "error_message", "started_at", "finished_at"],
    validation.flatMap((run) => run.items.map((item) => [run.id, item.username, item.status, item.displayName, item.attempts, item.errorCode, item.errorMessage, item.startedAt?.toISOString(), item.finishedAt?.toISOString()])),
  )));
  zip.addFile("telegram_campaigns.csv", Buffer.from(csvFile(
    ["campaign_id", "name", "status", "target_type", "mode", "message", "parse_mode", "targets", "processed", "sent", "failed", "skipped", "replied", "sessions", "reserved_credits", "reply_tracking", "created_at", "started_at", "finished_at", "error"],
    campaigns.map((run) => [run.id, run.name, run.status, run.targetType, run.mode, run.message, run.parseMode, run.totalCount, run.processedCount, run.sentCount, run.failedCount, run.skippedCount, run.repliedCount, run.sessionCount, run.reservedCredits, run.replyTrackingStatus, run.createdAt.toISOString(), run.startedAt?.toISOString(), run.finishedAt?.toISOString(), run.errorMessage]),
  )));
  zip.addFile("telegram_campaign_sessions.csv", Buffer.from(csvFile(
    ["campaign_id", "session_id", "session_label", "username", "phone", "status", "assigned", "sent", "failed", "last_error_code", "last_error_message"],
    campaigns.flatMap((run) => run.sessions.map((entry) => [run.id, entry.sessionId, entry.session.label, entry.session.username, entry.session.phone, entry.status, entry.assignedCount, entry.sentCount, entry.failedCount, entry.lastErrorCode, entry.lastErrorMessage])),
  )));
  zip.addFile("telegram_recipients.csv", Buffer.from(csvFile(
    ["campaign_id", "recipient_id", "target", "username", "telegram_id", "display_name", "status", "attempts", "session_id", "message_id", "sent_at", "error_code", "error_message", "replied", "replied_at", "reply_message_id", "reply_preview"],
    campaigns.flatMap((run) => run.recipients.map((item) => [run.id, item.id, item.targetInput, item.username, item.telegramId, item.displayName, item.status, item.attempts, item.sessionId, item.messageId, item.sentAt?.toISOString(), item.errorCode, item.errorMessage, item.replied, item.repliedAt?.toISOString(), item.replyMessageId, item.replyPreview])),
  )));
  zip.addFile("account_operations.csv", Buffer.from(csvFile(
    ["batch_id", "kind", "status", "total", "processed", "succeeded", "failed", "skipped", "cancel_requested", "created_at", "started_at", "finished_at", "error", "metadata_json"],
    accountBatches.map((batch) => [batch.id, batch.kind, batch.status, batch.totalCount, batch.processedCount, batch.succeededCount, batch.failedCount, batch.skippedCount, batch.cancelRequested, batch.createdAt.toISOString(), batch.startedAt?.toISOString(), batch.finishedAt?.toISOString(), batch.errorMessage, JSON.stringify(batch.metadata)]),
  )));
  zip.addFile("account_operation_jobs.csv", Buffer.from(csvFile(
    ["batch_id", "job_id", "session_id", "session_label", "action", "status", "attempts", "error_code", "error_message", "created_at", "finished_at", "payload_json", "result_json"],
    accountBatches.flatMap((batch) => batch.jobs.map((job) => [batch.id, job.id, job.sessionId, job.session.label, job.action, job.status, job.attempts, job.errorCode, job.errorMessage, job.createdAt.toISOString(), job.finishedAt?.toISOString(), JSON.stringify(job.payload), JSON.stringify(job.result)])),
  )));
  zip.addFile("ai_campaigns.csv", Buffer.from(csvFile(
    ["campaign_id", "name", "provider", "status", "duration", "model_id", "preset_id", "sessions", "incoming", "sent", "failed", "credits_used", "created_at", "started_at", "ends_at", "stopped_at", "grace_started_at", "grace_ends_at", "last_error"],
    aiCampaigns.map((run) => [run.id, run.name, run.provider, run.status, run.durationMode, run.modelId, run.presetId, run.sessions.length, run.messagesReceived, run.messagesSent, run.failedCount, run.creditsUsed, run.createdAt.toISOString(), run.startedAt.toISOString(), run.endsAt?.toISOString(), run.stoppedAt?.toISOString(), run.creditGraceStartedAt?.toISOString(), run.creditGraceEndsAt?.toISOString(), run.lastError]),
  )));
  zip.addFile("ai_campaign_sessions.csv", Buffer.from(csvFile(
    ["campaign_id", "session_id", "session_label", "username", "phone", "runtime_status", "last_connected_at", "last_heartbeat_at", "last_error"],
    aiCampaigns.flatMap((run) => run.sessions.map((entry) => [run.id, entry.sessionId, entry.session.label, entry.session.username, entry.session.phone, entry.runtimeStatus, entry.lastConnectedAt?.toISOString(), entry.lastHeartbeatAt?.toISOString(), entry.lastError])),
  )));
  zip.addFile("ai_conversations.csv", Buffer.from(csvFile(
    ["campaign_id", "memory_id", "session_id", "peer_id", "state", "last_category", "message_count", "recipient_json", "last_incoming_at", "last_outgoing_at", "updated_at"],
    aiCampaigns.flatMap((run) => run.memories.map((memory) => [run.id, memory.id, memory.sessionId, memory.peerId, memory.conversationState, memory.lastCategory, Array.isArray(memory.messages) ? memory.messages.length : 0, JSON.stringify(memory.recipient), memory.lastIncomingAt?.toISOString(), memory.lastOutgoingAt?.toISOString(), memory.updatedAt.toISOString()])),
  )));
  zip.addFile("ai_jobs.csv", Buffer.from(csvFile(
    ["campaign_id", "job_id", "session_id", "peer_id", "status", "attempts", "max_attempts", "follow_up", "run_after", "claimed_at", "finished_at", "error_code", "error_message"],
    aiCampaigns.flatMap((run) => run.jobs.map((job) => [run.id, job.id, job.sessionId, job.peerId, job.status, job.attempts, job.maxAttempts, job.isFollowUp, job.runAfter.toISOString(), job.claimedAt?.toISOString(), job.finishedAt?.toISOString(), job.errorCode, job.errorMessage])),
  )));
  zip.addFile("ai_response_logs.csv", Buffer.from(csvFile(
    ["campaign_id", "log_id", "session_id", "peer_id", "provider", "status", "category", "incoming_text", "response_text", "follow_up", "converted", "error_code", "error_message", "created_at"],
    aiCampaigns.flatMap((run) => run.responseLogs.map((log) => [run.id, log.id, log.sessionId, log.peerId, log.provider, log.status, log.category, log.incomingText, log.responseText, log.isFollowUp, log.didConvert, log.errorCode, log.errorMessage, log.createdAt.toISOString()])),
  )));
  const body = zip.toBuffer();
  const suffix = range.fromValue && range.toValue ? `_${range.fromValue.slice(0, 10)}_to_${range.toValue.slice(0, 10)}` : "_all_time";
  return new Response(new Uint8Array(body), {
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": `attachment; filename="signal_desk_report${suffix}.zip"`,
      "Content-Length": String(body.length),
    },
  });
}
