import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { aiConfig, aiCredentialView } from "@/lib/ai-chatter";
import { requireMessagingAccount } from "@/lib/validator-auth";
import { messagingUnauthorized } from "@/lib/validator-api";

const updateSchema = z.object({
  enabled: z.boolean().optional(),
  reengageEnabled: z.boolean().optional(),
  provider: z.enum(["capitalbot", "cupidbot"]).optional(),
  replyDelayMs: z.number().int().min(0).max(60_000).optional(),
  replyDelayJitterMs: z.number().int().min(0).max(60_000).optional(),
  memoryMessageLimit: z.number().int().min(10).max(200).optional(),
});

export async function GET() {
  const account = await requireMessagingAccount();
  if (!account) return messagingUnauthorized();
  const [setting, credentials, sessions, statusRows, jobRows, conversationCount, conversations, recentJobs] = await Promise.all([
    prisma.aiAccountSetting.findUnique({ where: { accountId: account.id } }),
    prisma.aiProviderCredential.findMany({ where: { accountId: account.id }, orderBy: { provider: "asc" } }),
    prisma.telegramSession.findMany({
      where: { accountId: account.id },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      select: {
        id: true, label: true, phone: true, username: true, firstName: true, lastName: true,
        status: true, isLoggedIn: true, spamStatus: true, riskScore: true, lastActiveAt: true,
        aiSetting: true,
      },
    }),
    prisma.aiResponseLog.groupBy({
      by: ["status"],
      where: { accountId: account.id },
      _count: { id: true },
    }),
    prisma.aiChatJob.groupBy({
      by: ["status"],
      where: { accountId: account.id },
      _count: { id: true },
    }),
    prisma.aiChatMemory.count({ where: { accountId: account.id } }),
    prisma.aiChatMemory.findMany({
      where: { accountId: account.id },
      orderBy: { updatedAt: "desc" },
      take: 100,
      include: {
        session: { select: { label: true, username: true, phone: true } },
      },
    }),
    prisma.aiChatJob.findMany({
      where: { accountId: account.id },
      orderBy: { createdAt: "desc" },
      take: 20,
      select: {
        id: true, sessionId: true, peerId: true, status: true, attempts: true, isFollowUp: true,
        errorCode: true, errorMessage: true, runAfter: true, createdAt: true, finishedAt: true,
      },
    }),
  ]);
  const statusBreakdown = Object.fromEntries(statusRows.map((row) => [row.status, row._count.id]));
  const queueBreakdown = Object.fromEntries(jobRows.map((row) => [row.status, row._count.id]));
  const sent = statusBreakdown.sent || 0;
  const failed = statusBreakdown.failed || 0;
  const completed = Object.values(statusBreakdown).reduce((sum, count) => sum + count, 0);
  return NextResponse.json({
    setting: {
      enabled: setting?.enabled || false,
      reengageEnabled: setting?.reengageEnabled ?? true,
      config: aiConfig(setting?.config),
    },
    providers: credentials.map(aiCredentialView),
    sessions: sessions.map((session) => ({
      ...session,
      aiSetting: session.aiSetting ? {
        enabled: session.aiSetting.enabled,
        config: session.aiSetting.config,
        runtimeStatus: session.aiSetting.runtimeStatus,
        lastConnectedAt: session.aiSetting.lastConnectedAt,
        lastHeartbeatAt: session.aiSetting.lastHeartbeatAt,
        lastError: session.aiSetting.lastError,
      } : null,
    })),
    overview: {
      conversations: conversationCount,
      completed,
      sent,
      failed,
      successRate: sent + failed ? Math.round((sent / (sent + failed)) * 100) : 0,
      statusBreakdown,
      queueBreakdown,
    },
    conversations: conversations.map((memory) => {
      const recipient = memory.recipient && typeof memory.recipient === "object" && !Array.isArray(memory.recipient)
        ? memory.recipient as Record<string, unknown>
        : {};
      const messages = Array.isArray(memory.messages) ? memory.messages : [];
      return {
        id: memory.id,
        sessionId: memory.sessionId,
        peerId: memory.peerId.toString(),
        recipientName: String(recipient.name || ""),
        recipientUsername: String(recipient.username || ""),
        messageCount: messages.length,
        conversationState: memory.conversationState,
        lastCategory: memory.lastCategory,
        lastIncomingAt: memory.lastIncomingAt,
        lastOutgoingAt: memory.lastOutgoingAt,
        updatedAt: memory.updatedAt,
        session: memory.session,
      };
    }),
    recentJobs: recentJobs.map((job) => ({ ...job, peerId: job.peerId.toString() })),
  });
}

export async function PATCH(request: Request) {
  const account = await requireMessagingAccount();
  if (!account) return messagingUnauthorized();
  const parsed = updateSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Enter valid AI Chatter settings" }, { status: 400 });
  const current = await prisma.aiAccountSetting.findUnique({ where: { accountId: account.id } });
  const config = aiConfig(current?.config);
  const nextConfig = aiConfig({ ...config, ...parsed.data });
  const nextEnabled = parsed.data.enabled ?? current?.enabled ?? false;
  if (nextEnabled) {
    const credential = await prisma.aiProviderCredential.findUnique({
      where: { accountId_provider: { accountId: account.id, provider: nextConfig.provider } },
    });
    if (!credential?.isValid) {
      return NextResponse.json({ error: `Add and validate a ${nextConfig.provider === "capitalbot" ? "CapitalBot" : "CupidBot"} credential first` }, { status: 409 });
    }
  }
  const setting = await prisma.aiAccountSetting.upsert({
    where: { accountId: account.id },
    create: {
      accountId: account.id,
      enabled: parsed.data.enabled ?? false,
      reengageEnabled: parsed.data.reengageEnabled ?? true,
      config: nextConfig,
    },
    update: {
      ...(parsed.data.enabled !== undefined ? { enabled: parsed.data.enabled } : {}),
      ...(parsed.data.reengageEnabled !== undefined ? { reengageEnabled: parsed.data.reengageEnabled } : {}),
      config: nextConfig,
    },
  });
  if (parsed.data.enabled === false) {
    await prisma.aiSessionSetting.updateMany({
      where: { accountId: account.id },
      data: { runtimeStatus: "stopping" },
    });
  }
  return NextResponse.json({
    setting: { enabled: setting.enabled, reengageEnabled: setting.reengageEnabled, config: aiConfig(setting.config) },
  });
}
