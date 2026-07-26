import { Prisma } from "@prisma/client";
import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import {
  AI_CAMPAIGN_ACTIVE_STATUSES,
  aiCampaignEndsAt,
  aiCampaignSummary,
} from "@/lib/ai-campaigns";
import { requireMessagingAccount } from "@/lib/validator-auth";
import { messagingUnauthorized } from "@/lib/validator-api";

type Context = { params: Promise<{ id: string }> };
const updateSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("stop") }),
  z.object({ action: z.literal("restart") }),
  z.object({
    action: z.literal("update"),
    name: z.string().trim().min(1).max(160).optional(),
    reengageEnabled: z.boolean().optional(),
  }),
]);

async function campaignDetail(accountId: string, id: string) {
  const campaign = await prisma.aiCampaign.findFirst({
    where: { id, accountId },
    include: {
      sessions: {
        orderBy: { position: "asc" },
        include: {
          session: {
            select: {
              id: true,
              label: true,
              username: true,
              phone: true,
              firstName: true,
              lastName: true,
              status: true,
              isLoggedIn: true,
              spamStatus: true,
              riskScore: true,
              lastActiveAt: true,
            },
          },
        },
      },
      _count: { select: { memories: true, jobs: true, responseLogs: true } },
    },
  });
  if (!campaign) return null;
  const [statusRows, jobRows, conversations, recentJobs, responseLogs] =
    await Promise.all([
      prisma.aiResponseLog.groupBy({
        by: ["status"],
        where: { campaignId: id },
        _count: { id: true },
      }),
      prisma.aiChatJob.groupBy({
        by: ["status"],
        where: { campaignId: id },
        _count: { id: true },
      }),
      prisma.aiChatMemory.findMany({
        where: { campaignId: id },
        orderBy: { updatedAt: "desc" },
        take: 250,
        include: { session: { select: { label: true, username: true, phone: true } } },
      }),
      prisma.aiChatJob.findMany({
        where: { campaignId: id },
        orderBy: { createdAt: "desc" },
        take: 100,
        select: {
          id: true,
          sessionId: true,
          peerId: true,
          status: true,
          attempts: true,
          isFollowUp: true,
          errorCode: true,
          errorMessage: true,
          runAfter: true,
          createdAt: true,
          finishedAt: true,
        },
      }),
      prisma.aiResponseLog.findMany({
        where: { campaignId: id },
        orderBy: { createdAt: "desc" },
        take: 100,
        select: {
          id: true,
          sessionId: true,
          peerId: true,
          provider: true,
          status: true,
          category: true,
          incomingText: true,
          responseText: true,
          isFollowUp: true,
          errorCode: true,
          errorMessage: true,
          createdAt: true,
        },
      }),
    ]);
  const statusBreakdown = Object.fromEntries(
    statusRows.map((row) => [row.status, row._count.id]),
  );
  const queueBreakdown = Object.fromEntries(
    jobRows.map((row) => [row.status, row._count.id]),
  );
  const sent = statusBreakdown.sent || 0;
  const failed = statusBreakdown.failed || 0;
  return {
    campaign: aiCampaignSummary(campaign),
    overview: {
      conversations: campaign._count.memories,
      sent,
      failed,
      successRate: sent + failed ? Math.round((sent / (sent + failed)) * 100) : 0,
      statusBreakdown,
      queueBreakdown,
    },
    conversations: conversations.map((memory) => {
      const recipient =
        memory.recipient &&
        typeof memory.recipient === "object" &&
        !Array.isArray(memory.recipient)
          ? (memory.recipient as Record<string, unknown>)
          : {};
      return {
        id: memory.id,
        sessionId: memory.sessionId,
        peerId: memory.peerId.toString(),
        recipientName: String(recipient.name || ""),
        recipientUsername: String(recipient.username || ""),
        messageCount: Array.isArray(memory.messages) ? memory.messages.length : 0,
        conversationState: memory.conversationState,
        lastCategory: memory.lastCategory,
        lastIncomingAt: memory.lastIncomingAt,
        lastOutgoingAt: memory.lastOutgoingAt,
        updatedAt: memory.updatedAt,
        session: memory.session,
      };
    }),
    recentJobs: recentJobs.map((job) => ({ ...job, peerId: job.peerId.toString() })),
    responseLogs: responseLogs.map((log) => ({ ...log, peerId: log.peerId.toString() })),
  };
}

export async function GET(_request: Request, { params }: Context) {
  const account = await requireMessagingAccount();
  if (!account) return messagingUnauthorized();
  if (!account.aiChatAccess) {
    return NextResponse.json({ error: "AI Chatter is not included in this plan" }, { status: 403 });
  }
  const result = await campaignDetail(account.id, (await params).id);
  return result
    ? NextResponse.json(result)
    : NextResponse.json({ error: "AI campaign not found" }, { status: 404 });
}

export async function PATCH(request: Request, { params }: Context) {
  const account = await requireMessagingAccount();
  if (!account) return messagingUnauthorized();
  if (!account.aiChatAccess) {
    return NextResponse.json({ error: "AI Chatter is not included in this plan" }, { status: 403 });
  }
  const parsed = updateSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Enter a valid campaign action" }, { status: 400 });
  }
  const id = (await params).id;
  const existing = await prisma.aiCampaign.findFirst({ where: { id, accountId: account.id } });
  if (!existing) return NextResponse.json({ error: "AI campaign not found" }, { status: 404 });

  try {
    if (parsed.data.action === "stop") {
      await prisma.$transaction(async (transaction) => {
        await transaction.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${account.id}))`;
        await transaction.aiCampaign.update({
          where: { id },
          data: { status: "stopped", stoppedAt: new Date(), lastError: null },
        });
        await transaction.aiCampaignSession.updateMany({
          where: { campaignId: id },
          data: { activeSessionId: null, runtimeStatus: "stopping" },
        });
        await transaction.aiChatJob.updateMany({
          where: { campaignId: id, status: { in: ["pending", "processing"] } },
          data: {
            status: "cancelled",
            errorCode: "CAMPAIGN_STOPPED",
            errorMessage: "Campaign stopped",
            finishedAt: new Date(),
          },
        });
      });
    } else if (parsed.data.action === "restart") {
      if (account.aiCampaignLimit === 0) {
        return NextResponse.json({ error: "This plan cannot run AI campaigns" }, { status: 403 });
      }
      await prisma.$transaction(async (transaction) => {
        await transaction.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${account.id}))`;
        const activeCount = await transaction.aiCampaign.count({
          where: {
            accountId: account.id,
            id: { not: id },
            status: { in: [...AI_CAMPAIGN_ACTIVE_STATUSES] },
          },
        });
        if (account.aiCampaignLimit !== null && activeCount >= account.aiCampaignLimit) {
          throw new Error(`AI campaign limit of ${account.aiCampaignLimit} reached`);
        }
        const memberships = await transaction.aiCampaignSession.findMany({
          where: { campaignId: id },
          include: { session: true },
        });
        const unavailable = memberships.find(
          ({ session }) =>
            session.status !== "active" ||
            !session.isLoggedIn ||
            session.spamStatus === "frozen",
        );
        if (unavailable) throw new Error(`${unavailable.session.label} is not available`);
        const ids = memberships.map(({ sessionId }) => sessionId);
        const leased = await transaction.aiCampaignSession.findFirst({
          where: { campaignId: { not: id }, activeSessionId: { in: ids } },
          include: { campaign: { select: { name: true } }, session: { select: { label: true } } },
        });
        if (leased) {
          throw new Error(`${leased.session.label} is assigned to ${leased.campaign.name}`);
        }
        const now = new Date();
        await transaction.aiCampaign.update({
          where: { id },
          data: {
            status: "starting",
            startedAt: now,
            endsAt: aiCampaignEndsAt(existing.durationMode as "day" | "week" | "until_stopped", now),
            stoppedAt: null,
            creditGraceStartedAt: null,
            creditGraceEndsAt: null,
            lastError: null,
          },
        });
        for (const membership of memberships) {
          await transaction.aiCampaignSession.update({
            where: { id: membership.id },
            data: {
              activeSessionId: membership.sessionId,
              runtimeStatus: "starting",
              catchupRequested: true,
              catchupClaimedAt: null,
              lastError: null,
            },
          });
        }
      });
    } else {
      await prisma.aiCampaign.update({
        where: { id },
        data: {
          ...(parsed.data.name ? { name: parsed.data.name } : {}),
          ...(parsed.data.reengageEnabled !== undefined
            ? { reengageEnabled: parsed.data.reengageEnabled }
            : {}),
        },
      });
    }
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return NextResponse.json({ error: "A session was claimed by another campaign" }, { status: 409 });
    }
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Campaign update failed" },
      { status: 409 },
    );
  }
  return NextResponse.json(await campaignDetail(account.id, id));
}

export async function DELETE(_request: Request, { params }: Context) {
  const account = await requireMessagingAccount();
  if (!account) return messagingUnauthorized();
  const id = (await params).id;
  const campaign = await prisma.aiCampaign.findFirst({
    where: { id, accountId: account.id },
    select: { status: true },
  });
  if (!campaign) return NextResponse.json({ error: "AI campaign not found" }, { status: 404 });
  if (AI_CAMPAIGN_ACTIVE_STATUSES.includes(campaign.status as (typeof AI_CAMPAIGN_ACTIVE_STATUSES)[number])) {
    return NextResponse.json({ error: "Stop the campaign before deleting it" }, { status: 409 });
  }
  const draining = await prisma.aiCampaignSession.count({
    where: { campaignId: id, runtimeStatus: { in: ["starting", "listening", "stopping"] } },
  });
  if (draining) {
    return NextResponse.json({ error: "Wait for campaign listeners to finish stopping" }, { status: 409 });
  }
  await prisma.aiCampaign.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
