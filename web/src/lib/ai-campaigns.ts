import { Prisma } from "@prisma/client";
import { aiConfig } from "@/lib/ai-chatter";

export const AI_CAMPAIGN_ACTIVE_STATUSES = [
  "starting",
  "running",
  "credit_grace",
] as const;
export const AI_CAMPAIGN_TERMINAL_STATUSES = [
  "stopped",
  "expired",
  "grace_expired",
  "error",
] as const;

export type AiCampaignDuration = "day" | "week" | "until_stopped";

export function aiCampaignEndsAt(duration: AiCampaignDuration, now = new Date()) {
  if (duration === "until_stopped") return null;
  return new Date(
    now.getTime() + (duration === "day" ? 1 : 7) * 24 * 60 * 60 * 1000,
  );
}

export function aiCampaignConfig(input: {
  provider: "capitalbot" | "cupidbot";
  replyDelayMs?: number;
  replyDelayJitterMs?: number;
  memoryMessageLimit?: number;
  responseLanguage?: string;
}) {
  const config = aiConfig({
    provider: input.provider,
    replyDelayMs: input.replyDelayMs,
    replyDelayJitterMs: input.replyDelayJitterMs,
    memoryMessageLimit: input.memoryMessageLimit,
    capitalbot: { language: input.responseLanguage },
    cupidbot: { responseLanguage: input.responseLanguage },
  });
  return config as Prisma.InputJsonValue;
}

export function aiCampaignSummary(campaign: {
  id: string;
  name: string;
  provider: string;
  modelId: number | null;
  presetId: number | null;
  config: Prisma.JsonValue;
  reengageEnabled: boolean;
  durationMode: string;
  status: string;
  messagesReceived: number;
  messagesSent: number;
  failedCount: number;
  creditsUsed: number;
  startedAt: Date;
  endsAt: Date | null;
  stoppedAt: Date | null;
  creditGraceStartedAt: Date | null;
  creditGraceEndsAt: Date | null;
  lastError: string | null;
  createdAt: Date;
  updatedAt: Date;
  sessions: Array<{
    sessionId: string;
    runtimeStatus: string;
    lastHeartbeatAt: Date | null;
    lastError: string | null;
    session: {
      label: string;
      username: string | null;
      phone: string | null;
      status: string;
      isLoggedIn: boolean;
    };
  }>;
  _count?: { memories: number; jobs: number; responseLogs: number };
}) {
  return {
    id: campaign.id,
    name: campaign.name,
    provider: campaign.provider,
    modelId: campaign.modelId,
    presetId: campaign.presetId,
    config: aiConfig(campaign.config),
    reengageEnabled: campaign.reengageEnabled,
    durationMode: campaign.durationMode,
    status: campaign.status,
    messagesReceived: campaign.messagesReceived,
    messagesSent: campaign.messagesSent,
    failedCount: campaign.failedCount,
    creditsUsed: campaign.creditsUsed,
    startedAt: campaign.startedAt,
    endsAt: campaign.endsAt,
    stoppedAt: campaign.stoppedAt,
    creditGraceStartedAt: campaign.creditGraceStartedAt,
    creditGraceEndsAt: campaign.creditGraceEndsAt,
    lastError: campaign.lastError,
    createdAt: campaign.createdAt,
    updatedAt: campaign.updatedAt,
    sessions: campaign.sessions,
    sessionCount: campaign.sessions.length,
    liveListeners: campaign.sessions.filter(
      (membership) => membership.runtimeStatus === "listening",
    ).length,
    conversations: campaign._count?.memories || 0,
    jobs: campaign._count?.jobs || 0,
    responseLogs: campaign._count?.responseLogs || 0,
  };
}
