import { Prisma } from "@prisma/client";
import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { validateAiProvider } from "@/lib/ai-chatter";
import { CAPITALBOT_RESPONSE_LANGUAGES } from "@/lib/ai-chatter-languages";
import {
  AI_CAMPAIGN_ACTIVE_STATUSES,
  aiCampaignConfig,
  aiCampaignEndsAt,
  aiCampaignSummary,
} from "@/lib/ai-campaigns";
import { encryptTelegramData } from "@/lib/telegram-crypto";
import { requireMessagingAccount } from "@/lib/validator-auth";
import { messagingUnauthorized } from "@/lib/validator-api";

const createSchema = z.object({
  name: z.string().trim().min(1).max(160),
  provider: z.enum(["capitalbot", "cupidbot"]),
  secret: z.string().trim().min(8).max(1000),
  modelId: z.number().int().positive().nullable().optional(),
  presetId: z.number().int().positive().nullable().optional(),
  responseLanguage: z.enum(CAPITALBOT_RESPONSE_LANGUAGES).default("English"),
  durationMode: z.enum(["day", "week", "until_stopped"]),
  reengageEnabled: z.boolean().default(true),
  replyDelayMs: z.number().int().min(0).max(60_000).default(3000),
  replyDelayJitterMs: z.number().int().min(0).max(60_000).default(2000),
  memoryMessageLimit: z.number().int().min(10).max(200).default(100),
  sessionIds: z.array(z.string().min(1)).max(1000).default([]),
  sessionListIds: z.array(z.string().min(1)).max(100).default([]),
});

function aiUnavailable() {
  return NextResponse.json(
    { error: "AI Chatter is not included in this plan", aiChatAccess: false },
    { status: 403 },
  );
}

export async function GET() {
  const account = await requireMessagingAccount();
  if (!account) return messagingUnauthorized();
  if (!account.aiChatAccess) return aiUnavailable();

  const [campaigns, sessions, sessionLists] = await Promise.all([
    prisma.aiCampaign.findMany({
      where: { accountId: account.id },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      include: {
        sessions: {
          orderBy: { position: "asc" },
          include: {
            session: {
              select: {
                label: true,
                username: true,
                phone: true,
                status: true,
                isLoggedIn: true,
              },
            },
          },
        },
        _count: { select: { memories: true, jobs: true, responseLogs: true } },
      },
    }),
    prisma.telegramSession.findMany({
      where: { accountId: account.id },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      select: {
        id: true,
        label: true,
        phone: true,
        username: true,
        firstName: true,
        lastName: true,
        status: true,
        isLoggedIn: true,
        spamStatus: true,
        riskScore: true,
        lastActiveAt: true,
        aiCampaignMemberships: {
          where: { activeSessionId: { not: null } },
          select: { campaignId: true, campaign: { select: { name: true } } },
          take: 1,
        },
      },
    }),
    prisma.telegramSessionList.findMany({
      where: { accountId: account.id },
      orderBy: { name: "asc" },
      select: {
        id: true,
        name: true,
        members: { select: { sessionId: true }, orderBy: { position: "asc" } },
      },
    }),
  ]);

  return NextResponse.json({
    creditsBalance: account.creditsBalance,
    campaignLimit: account.aiCampaignLimit,
    activeCampaigns: campaigns.filter((campaign) =>
      AI_CAMPAIGN_ACTIVE_STATUSES.includes(
        campaign.status as (typeof AI_CAMPAIGN_ACTIVE_STATUSES)[number],
      ),
    ).length,
    campaigns: campaigns.map(aiCampaignSummary),
    sessions: sessions.map((session) => ({
      ...session,
      assignedCampaign: session.aiCampaignMemberships[0]
        ? {
            id: session.aiCampaignMemberships[0].campaignId,
            name: session.aiCampaignMemberships[0].campaign.name,
          }
        : null,
      aiCampaignMemberships: undefined,
    })),
    sessionLists: sessionLists.map((list) => ({
      id: list.id,
      name: list.name,
      sessionIds: list.members.map((member) => member.sessionId),
    })),
  });
}

export async function POST(request: Request) {
  const account = await requireMessagingAccount();
  if (!account) return messagingUnauthorized();
  if (!account.aiChatAccess || account.aiCampaignLimit === 0) return aiUnavailable();
  const parsed = createSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message || "Enter valid campaign settings" },
      { status: 400 },
    );
  }

  const providerCheck = await validateAiProvider(
    parsed.data.provider,
    parsed.data.secret,
  ).catch((error) => ({
    valid: false,
    catalog: null,
    error: error instanceof Error ? error.message : "Provider validation failed",
  }));
  if (!providerCheck.valid) {
    return NextResponse.json(
      { error: providerCheck.error || "Provider rejected this credential" },
      { status: 422 },
    );
  }

  const catalog = providerCheck.catalog as {
    models?: Array<Record<string, unknown>>;
    presets?: Array<Record<string, unknown>>;
  } | null;
  const firstModel = catalog?.models?.[0];
  const firstPreset = catalog?.presets?.[0];
  const modelId =
    parsed.data.modelId ??
    (Number(firstModel?.modelId || firstModel?.id || 0) || null);
  const presetId =
    parsed.data.presetId ??
    (Number(firstPreset?.id || firstPreset?.presetId || 0) || null);

  try {
    const campaign = await prisma.$transaction(async (transaction) => {
      await transaction.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${account.id}))`;
      const activeCount = await transaction.aiCampaign.count({
        where: {
          accountId: account.id,
          status: { in: [...AI_CAMPAIGN_ACTIVE_STATUSES] },
        },
      });
      if (
        account.aiCampaignLimit !== null &&
        activeCount >= account.aiCampaignLimit
      ) {
        throw new Error(`AI campaign limit of ${account.aiCampaignLimit} reached`);
      }

      const listMembers = parsed.data.sessionListIds.length
        ? await transaction.telegramSessionListMember.findMany({
            where: {
              listId: { in: parsed.data.sessionListIds },
              list: { accountId: account.id },
            },
            select: { sessionId: true },
          })
        : [];
      const sessionIds = [
        ...new Set([
          ...parsed.data.sessionIds,
          ...listMembers.map((member) => member.sessionId),
        ]),
      ];
      if (!sessionIds.length) throw new Error("Select at least one Telegram session");
      const sessions = await transaction.telegramSession.findMany({
        where: { id: { in: sessionIds }, accountId: account.id },
        select: {
          id: true,
          label: true,
          status: true,
          isLoggedIn: true,
          spamStatus: true,
        },
      });
      if (sessions.length !== sessionIds.length) {
        throw new Error("One or more Telegram sessions were not found");
      }
      const unavailable = sessions.find(
        (session) =>
          session.status !== "active" ||
          !session.isLoggedIn ||
          session.spamStatus === "frozen",
      );
      if (unavailable) {
        throw new Error(
          `${unavailable.label} must be active, logged in, and non-frozen`,
        );
      }
      const leased = await transaction.aiCampaignSession.findFirst({
        where: { activeSessionId: { in: sessionIds } },
        include: { campaign: { select: { name: true } }, session: { select: { label: true } } },
      });
      if (leased) {
        throw new Error(
          `${leased.session.label} is already assigned to ${leased.campaign.name}`,
        );
      }

      const now = new Date();
      return transaction.aiCampaign.create({
        data: {
          accountId: account.id,
          name: parsed.data.name,
          provider: parsed.data.provider,
          secretEncrypted: encryptTelegramData(parsed.data.secret),
          modelId,
          presetId,
          catalog: (providerCheck.catalog || undefined) as Prisma.InputJsonValue | undefined,
          config: aiCampaignConfig(parsed.data),
          reengageEnabled: parsed.data.reengageEnabled,
          durationMode: parsed.data.durationMode,
          status: "starting",
          startedAt: now,
          endsAt: aiCampaignEndsAt(parsed.data.durationMode, now),
          sessions: {
            create: sessionIds.map((sessionId, position) => ({
              sessionId,
              activeSessionId: sessionId,
              position,
              runtimeStatus: "starting",
              catchupRequested: true,
            })),
          },
        },
        include: {
          sessions: {
            orderBy: { position: "asc" },
            include: {
              session: {
                select: {
                  label: true,
                  username: true,
                  phone: true,
                  status: true,
                  isLoggedIn: true,
                },
              },
            },
          },
          _count: { select: { memories: true, jobs: true, responseLogs: true } },
        },
      });
    });
    return NextResponse.json({ campaign: aiCampaignSummary(campaign) }, { status: 201 });
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      return NextResponse.json(
        { error: "A selected Telegram session was assigned to another campaign" },
        { status: 409 },
      );
    }
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Campaign creation failed" },
      { status: 409 },
    );
  }
}
