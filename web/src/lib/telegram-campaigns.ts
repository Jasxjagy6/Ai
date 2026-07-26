import { Prisma } from "@prisma/client";
import { createHash } from "node:crypto";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import {
  debitValidatorCredits,
  quoteValidatorTask,
} from "@/lib/validator-credits";
import {
  TelegramControlError,
  telegramSessionSafety,
} from "@/lib/telegram-control";

const campaignSchema = z
  .object({
    name: z.string().trim().min(1).max(160),
    message: z.string().min(1).max(4096),
    targetType: z.enum(["users", "groups"]).default("users"),
    mode: z
      .enum(["balanced", "parallel", "split", "failover", "fanout"])
      .default("balanced"),
    parseMode: z.enum(["text", "markdown", "html"]).default("text"),
    sourceListId: z.string().trim().min(1).nullable().optional(),
    sessionIds: z.array(z.string().trim().min(1)).min(1).max(500),
    manualTargets: z
      .union([
        z.string().max(2_000_000),
        z.array(z.string().max(220)).max(200_000),
      ])
      .optional(),
    trackReplies: z.boolean().default(true),
    replyWindowHours: z.number().int().min(1).max(168).default(24),
    minDelaySeconds: z.number().min(0).max(3600).default(3),
    maxDelaySeconds: z.number().min(0).max(3600).default(8),
    maxFloodWaitSeconds: z.number().int().min(0).max(86400).default(120),
    pacingMode: z.enum(["auto", "manual"]).default("auto"),
    perSessionBurst: z.number().int().min(1).max(500).default(5),
    cooldownSecondsMin: z.number().min(0).max(1800).default(15),
    cooldownSecondsMax: z.number().min(0).max(1800).default(30),
    perSessionQuota: z.number().int().min(1).max(200_000).default(10),
  })
  .refine((value) => value.maxDelaySeconds >= value.minDelaySeconds, {
    message: "Maximum delay must be greater than or equal to minimum delay",
  })
  .refine((value) => value.cooldownSecondsMax >= value.cooldownSecondsMin, {
    message:
      "Maximum cooldown must be greater than or equal to minimum cooldown",
  });

export type TelegramCampaignCandidate = {
  targetKey: string;
  targetInput: string;
  username?: string;
  telegramId?: bigint;
  accessHash?: bigint;
  phone?: string;
  displayName?: string;
};

const MIN_BIGINT = BigInt("-9223372036854775808");
const MAX_BIGINT = BigInt("9223372036854775807");

export function telegramCampaignCandidate(
  input: string,
  targetType: "users" | "groups",
): TelegramCampaignCandidate | null {
  const value = input.trim();
  if (!value || value.length > 220) return null;
  if (
    targetType === "groups" &&
    /^(?:https?:\/\/)?(?:www\.)?t(?:elegram)?\.(?:me|dog)\/(?:joinchat\/|\+)[A-Za-z0-9_-]+\/?$/i.test(
      value,
    )
  ) {
    const normalized = value
      .replace(/^https?:\/\//i, "")
      .replace(/^www\./i, "")
      .replace(/\/$/, "")
      .toLowerCase();
    return {
      targetKey: `invite:${createHash("sha256").update(normalized).digest("hex")}`,
      targetInput: value,
    };
  }
  const usernameMatch = value.match(
    /^(?:https?:\/\/)?(?:www\.)?t(?:elegram)?\.(?:me|dog)\/([A-Za-z][A-Za-z0-9_]{4,31})\/?$/i,
  );
  const username = (usernameMatch?.[1] || value.replace(/^@/, "")).trim();
  if (/^[A-Za-z][A-Za-z0-9_]{4,31}$/.test(username)) {
    return {
      targetKey: `username:${username.toLowerCase()}`,
      targetInput: value,
      username,
    };
  }
  if (/^-?\d{5,20}$/.test(value)) {
    try {
      const telegramId = BigInt(value);
      if (telegramId < MIN_BIGINT || telegramId > MAX_BIGINT) return null;
      return { targetKey: `id:${telegramId}`, targetInput: value, telegramId };
    } catch {
      return null;
    }
  }
  return null;
}

function campaignView(campaign: {
  id: string;
  name: string;
  targetType: string;
  mode: string;
  message: string;
  parseMode: string;
  status: string;
  totalCount: number;
  processedCount: number;
  sentCount: number;
  failedCount: number;
  skippedCount: number;
  repliedCount: number;
  sessionCount: number;
  trackReplies: boolean;
  replyWindowHours: number;
  replyTrackingStatus: string;
  replyTrackingUntil: Date | null;
  replyTrackingLastScanAt: Date | null;
  cancelRequested: boolean;
  currentTarget: string | null;
  errorMessage: string | null;
  createdAt: Date;
  startedAt: Date | null;
  finishedAt: Date | null;
  lastProgressAt: Date;
  scheduleId?: string | null;
  configuration?: Prisma.JsonValue | null;
  reservedMessages?: number;
  reservedCredits?: number;
  quotaSettled?: boolean;
  creditsSettled?: boolean;
  schedule?: {
    id: string;
    name: string;
    intervalMinutes: number;
  } | null;
}) {
  return {
    ...campaign,
    progressPct: campaign.totalCount
      ? Math.round((campaign.processedCount / campaign.totalCount) * 100)
      : 0,
  };
}

export async function createTelegramCampaign(
  account: {
    id: string;
    accessKeyId: string | null;
  },
  input: unknown,
) {
  const parsed = campaignSchema.safeParse(input);
  if (!parsed.success)
    throw new TelegramControlError(
      parsed.error.issues[0]?.message || "Enter valid campaign settings",
    );
  if (!account.accessKeyId)
    throw new TelegramControlError(
      "An active messaging access key is required",
      403,
      "MESSAGING_ACCESS_REQUIRED",
    );
  const data = parsed.data;
  if (data.targetType === "groups" && data.mode !== "fanout") {
    throw new TelegramControlError(
      "Group and channel campaigns must use every-session fan-out",
      400,
      "TELEGRAM_GROUP_FANOUT_REQUIRED",
    );
  }
  if (data.targetType === "groups" && data.sourceListId) {
    throw new TelegramControlError(
      "Group and channel campaigns require manual destinations",
      400,
      "TELEGRAM_GROUP_LIST_UNSUPPORTED",
    );
  }
  const requestedSessionIds = [...new Set(data.sessionIds)];
  const sessionRows = await prisma.telegramSession.findMany({
    where: {
      id: { in: requestedSessionIds },
      accountId: account.id,
      isLoggedIn: true,
      status: "active",
    },
  });
  if (sessionRows.length !== requestedSessionIds.length)
    throw new TelegramControlError(
      "Select only active Telegram sessions",
      400,
      "TELEGRAM_SESSION_INACTIVE",
    );
  const sessionById = new Map(
    sessionRows.map((session) => [session.id, session]),
  );
  const sessions = requestedSessionIds.map((id) => sessionById.get(id)!);
  const blockedSessions = sessions
    .map((session) => ({ session, safety: telegramSessionSafety(session) }))
    .filter((item) => !item.safety.massDmEligible);
  if (blockedSessions.length) {
    const first = blockedSessions[0];
    throw new TelegramControlError(
      `${first.session.label}: ${first.safety.eligibilityReason}${blockedSessions.length > 1 ? ` (${blockedSessions.length} selected sessions blocked)` : ""}`,
      423,
      "NO_MASS_DM_ELIGIBLE_SESSIONS",
    );
  }
  const sessionIds = sessions.map((session) => session.id);

  const candidates = new Map<string, TelegramCampaignCandidate>();
  if (data.sourceListId) {
    const list = await prisma.contactList.findFirst({
      where: { id: data.sourceListId, accountId: account.id },
      select: { id: true, type: true, itemsCount: true },
    });
    if (!list)
      throw new TelegramControlError(
        "Source list not found",
        404,
        "TELEGRAM_SOURCE_LIST_NOT_FOUND",
      );
    if (!["users", "merged"].includes(list.type))
      throw new TelegramControlError(
        "User campaigns require a Users or Merged source list",
        400,
        "TELEGRAM_SOURCE_LIST_TYPE_INVALID",
      );
    if (list.itemsCount > 200_000)
      throw new TelegramControlError(
        "Campaign lists are limited to 200,000 rows",
        413,
        "TELEGRAM_CAMPAIGN_TOO_LARGE",
      );
    const items = await prisma.listItem.findMany({
      where: { listId: list.id },
      orderBy: [{ addedAt: "asc" }, { id: "asc" }],
      select: {
        telegramId: true,
        username: true,
        accessHash: true,
        phone: true,
        firstName: true,
        lastName: true,
      },
    });
    for (const item of items) {
      const username = item.username?.replace(/^@/, "").trim();
      const candidate =
        username && /^[A-Za-z][A-Za-z0-9_]{4,31}$/.test(username)
          ? {
              targetKey: `username:${username.toLowerCase()}`,
              targetInput: `@${username}`,
              username,
              telegramId: item.telegramId || undefined,
              accessHash: item.accessHash || undefined,
              phone: item.phone || undefined,
              displayName:
                [item.firstName, item.lastName].filter(Boolean).join(" ") ||
                undefined,
            }
          : item.telegramId
            ? {
                targetKey: `id:${item.telegramId}`,
                targetInput: item.telegramId.toString(),
                telegramId: item.telegramId,
                accessHash: item.accessHash || undefined,
                phone: item.phone || undefined,
                displayName:
                  [item.firstName, item.lastName].filter(Boolean).join(" ") ||
                  undefined,
              }
            : null;
      if (candidate) candidates.set(candidate.targetKey, candidate);
    }
  }
  const manual = Array.isArray(data.manualTargets)
    ? data.manualTargets
    : (data.manualTargets || "").split(/\r?\n|,/);
  for (const value of manual) {
    const candidate = telegramCampaignCandidate(value, data.targetType);
    if (candidate) candidates.set(candidate.targetKey, candidate);
  }
  if (!candidates.size)
    throw new TelegramControlError(
      data.targetType === "groups"
        ? "Add at least one valid group or channel"
        : "Add at least one valid username or Telegram ID",
      400,
      "TELEGRAM_TARGETS_REQUIRED",
    );
  if (
    data.targetType === "users" &&
    data.mode === "fanout" &&
    candidates.size > 50
  ) {
    throw new TelegramControlError(
      "Every-account DM is limited to 50 unique targets",
      400,
      "TELEGRAM_FANOUT_TARGET_LIMIT",
    );
  }

  const transmissions: Array<
    TelegramCampaignCandidate & { sessionId: string | null }
  > = [];
  if (data.mode === "fanout") {
    for (const candidate of candidates.values()) {
      for (const sessionId of sessionIds)
        transmissions.push({
          ...candidate,
          targetKey: `${candidate.targetKey}:session:${sessionId}`,
          sessionId,
        });
    }
  } else if (data.mode === "split") {
    const values = [...candidates.values()];
    const effectiveQuota = Math.max(
      data.perSessionQuota,
      Math.ceil(values.length / sessionIds.length),
    );
    values.forEach((candidate, index) =>
      transmissions.push({
        ...candidate,
        sessionId:
          sessionIds[
            Math.min(sessionIds.length - 1, Math.floor(index / effectiveQuota))
          ],
      }),
    );
  } else {
    let index = 0;
    for (const candidate of candidates.values()) {
      transmissions.push({
        ...candidate,
        sessionId:
          data.mode === "failover"
            ? null
            : sessionIds[index++ % sessionIds.length],
      });
    }
  }
  const assignedCounts = new Map<string, number>();
  for (const transmission of transmissions) {
    if (!transmission.sessionId) continue;
    assignedCounts.set(
      transmission.sessionId,
      (assignedCounts.get(transmission.sessionId) || 0) + 1,
    );
  }
  if (transmissions.length > 200_000)
    throw new TelegramControlError(
      "Campaigns are limited to 200,000 message attempts",
      413,
      "TELEGRAM_CAMPAIGN_TOO_LARGE",
    );
  const creditQuote = await quoteValidatorTask("campaign_send", {
    items: transmissions.length,
    sessions: sessionIds.length,
  });
  const capacities = new Map(
    sessions.map((session) => [
      session.id,
      telegramSessionSafety(session).dailyMessagesRemaining,
    ]),
  );
  if (data.mode === "failover" || data.mode === "parallel") {
    const totalCapacity = [...capacities.values()].reduce<number | null>(
      (total, capacity) =>
        total == null || capacity == null ? null : total + capacity,
      0,
    );
    if (totalCapacity != null && transmissions.length > totalCapacity)
      throw new TelegramControlError(
        "Campaign exceeds the selected sessions' daily warmup capacity",
        423,
        "TELEGRAM_WARMUP_CAPACITY_EXCEEDED",
      );
  } else {
    const assigned = new Map<string, number>();
    for (const transmission of transmissions)
      if (transmission.sessionId)
        assigned.set(
          transmission.sessionId,
          (assigned.get(transmission.sessionId) || 0) + 1,
        );
    for (const [sessionId, count] of assigned) {
      const capacity = capacities.get(sessionId);
      if (capacity != null && count > capacity)
        throw new TelegramControlError(
          "Campaign exceeds one or more sessions' daily warmup capacity",
          423,
          "TELEGRAM_WARMUP_CAPACITY_EXCEEDED",
        );
    }
  }

  return prisma.$transaction(
    async (transaction) => {
      const [accessKey] = await transaction.$queryRaw<
        Array<{
          accountId: string;
          revoked: boolean;
          messagingAccess: boolean;
          expiresAt: Date | null;
          messageLimit: number | null;
          messagesUsed: number;
        }>
      >(Prisma.sql`SELECT "accountId", revoked, "messagingAccess", "expiresAt",
          "messageLimit", "messagesUsed" FROM "ValidatorAccessKey"
          WHERE id = ${account.accessKeyId!} FOR UPDATE`);
      if (
        !accessKey ||
        accessKey.accountId !== account.id ||
        accessKey.revoked ||
        !accessKey.messagingAccess ||
        (accessKey.expiresAt && accessKey.expiresAt <= new Date())
      )
        throw new TelegramControlError(
          "Messaging access is no longer active",
          403,
          "MESSAGING_ACCESS_REQUIRED",
        );
      if (
        accessKey.messageLimit != null &&
        accessKey.messagesUsed + transmissions.length > accessKey.messageLimit
      )
        throw new TelegramControlError(
          "This campaign exceeds the active access key's remaining message allowance",
          429,
          "TELEGRAM_MESSAGE_LIMIT_EXCEEDED",
        );
      await transaction.validatorAccessKey.update({
        where: { id: account.accessKeyId! },
        data: { messagesUsed: { increment: transmissions.length } },
      });
      const campaign = await transaction.telegramCampaign.create({
        data: {
          accountId: account.id,
          accessKeyId: account.accessKeyId,
          sourceListId: data.sourceListId || null,
          name: data.name,
          targetType: data.targetType,
          mode: data.mode,
          message: data.message,
          parseMode: data.parseMode,
          totalCount: transmissions.length,
          sessionCount: sessionIds.length,
          reservedMessages: transmissions.length,
          reservedCredits: creditQuote.credits,
          creditItemCost: creditQuote.price.itemCost,
          trackReplies: data.targetType === "users" && data.trackReplies,
          replyWindowHours: data.replyWindowHours,
          configuration: {
            minDelaySeconds: data.minDelaySeconds,
            maxDelaySeconds: data.maxDelaySeconds,
            maxFloodWaitSeconds: data.maxFloodWaitSeconds,
            pacingMode: data.pacingMode,
            perSessionBurst: data.perSessionBurst,
            cooldownSecondsMin: data.cooldownSecondsMin,
            cooldownSecondsMax: data.cooldownSecondsMax,
            perSessionQuota: data.perSessionQuota,
            creditPricing: creditQuote.price,
          },
          sessions: {
            create: sessionIds.map((sessionId, position) => ({
              sessionId,
              position,
              assignedCount: assignedCounts.get(sessionId) || 0,
            })),
          },
        },
      });
      await debitValidatorCredits(transaction, {
        accountId: account.id,
        accessKeyId: account.accessKeyId,
        credits: creditQuote.credits,
        taskCode: "campaign_send",
        description: `${transmissions.length.toLocaleString()} Telegram message attempts`,
        referenceType: "telegram_campaign",
        referenceId: campaign.id,
        metadata: {
          attempts: transmissions.length,
          sessions: sessionIds.length,
          mode: data.mode,
        },
      });
      for (let offset = 0; offset < transmissions.length; offset += 1000) {
        await transaction.telegramCampaignRecipient.createMany({
          data: transmissions.slice(offset, offset + 1000).map((candidate) => ({
            campaignId: campaign.id,
            sessionId: candidate.sessionId,
            targetKey: candidate.targetKey,
            targetInput: candidate.targetInput,
            username: candidate.username,
            telegramId: candidate.telegramId,
            accessHash: candidate.accessHash,
            phone: candidate.phone,
            displayName: candidate.displayName,
          })),
        });
      }
      return campaignView(campaign);
    },
    {
      timeout: 120_000,
      isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
    },
  );
}

export async function listTelegramCampaigns(accountId: string, limit = 50, from?: string, to?: string) {
  const where: Record<string, unknown> = { accountId };
  if (from || to) {
    const createdAt: Record<string, Date> = {};
    if (from) createdAt.gte = new Date(from);
    if (to) createdAt.lte = new Date(to);
    where.createdAt = createdAt;
  }
  const campaigns = await prisma.telegramCampaign.findMany({
    where: where as Prisma.TelegramCampaignWhereInput,
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: Math.max(1, Math.min(100, limit)),
  });
  return campaigns.map(campaignView);
}

export async function getTelegramCampaign(
  accountId: string,
  campaignId: string,
  options: {
    page?: number;
    pageSize?: number;
    search?: string;
    status?: string;
    reply?: string;
    sessionId?: string;
  } = {},
) {
  const campaign = await prisma.telegramCampaign.findFirst({
    where: { id: campaignId, accountId },
    include: {
      schedule: {
        select: { id: true, name: true, intervalMinutes: true },
      },
    },
  });
  if (!campaign)
    throw new TelegramControlError(
      "Campaign not found",
      404,
      "TELEGRAM_CAMPAIGN_NOT_FOUND",
    );
  const requestedPage = Number(options.page);
  const requestedPageSize = Number(options.pageSize);
  const page = Number.isFinite(requestedPage)
    ? Math.max(1, Math.trunc(requestedPage))
    : 1;
  const pageSize = Number.isFinite(requestedPageSize)
    ? Math.max(25, Math.min(500, Math.trunc(requestedPageSize)))
    : 100;
  const search = options.search?.trim().slice(0, 160);
  const parsedNumericSearch =
    search && /^-?\d{1,20}$/.test(search) ? BigInt(search) : null;
  const numericSearch =
    parsedNumericSearch != null &&
    parsedNumericSearch >= MIN_BIGINT &&
    parsedNumericSearch <= MAX_BIGINT
      ? parsedNumericSearch
      : null;
  const recipientWhere: Prisma.TelegramCampaignRecipientWhereInput = {
    campaignId,
    ...(options.status && options.status !== "all"
      ? { status: options.status }
      : {}),
    ...(options.reply === "replied"
      ? { replied: true }
      : options.reply === "no_reply"
        ? { replied: false, status: "sent" }
        : {}),
    ...(options.sessionId && options.sessionId !== "all"
      ? { sessionId: options.sessionId }
      : {}),
    ...(search
      ? {
          OR: [
            { targetInput: { contains: search, mode: "insensitive" } },
            { username: { contains: search, mode: "insensitive" } },
            { displayName: { contains: search, mode: "insensitive" } },
            { phone: { contains: search, mode: "insensitive" } },
            { errorCode: { contains: search, mode: "insensitive" } },
            { errorMessage: { contains: search, mode: "insensitive" } },
            ...(numericSearch == null
              ? []
              : [
                  { telegramId: numericSearch },
                  { messageId: numericSearch },
                  { replyMessageId: numericSearch },
                ]),
          ],
        }
      : {}),
  };
  const [recipients, recipientCount, sessions, sessionRecipientCounts, sessionReplyCounts] = await Promise.all([
    prisma.telegramCampaignRecipient.findMany({
      where: recipientWhere,
      orderBy: [{ createdAt: "asc" }, { id: "asc" }],
      skip: (page - 1) * pageSize,
      take: pageSize,
      select: {
        id: true,
        sessionId: true,
        targetInput: true,
        username: true,
        telegramId: true,
        phone: true,
        displayName: true,
        status: true,
        attempts: true,
        messageId: true,
        errorCode: true,
        errorMessage: true,
        sentAt: true,
        replied: true,
        repliedAt: true,
        replyMessageId: true,
        replyPreview: true,
        lastCheckedAt: true,
        session: {
          select: { label: true, username: true, phone: true },
        },
      },
    }),
    prisma.telegramCampaignRecipient.count({ where: recipientWhere }),
    prisma.telegramCampaignSession.findMany({
      where: { campaignId },
      orderBy: { position: "asc" },
      include: {
        session: { select: { label: true, username: true, phone: true } },
      },
    }),
    prisma.telegramCampaignRecipient.groupBy({
      by: ["sessionId"],
      where: { campaignId, sessionId: { not: null } },
      _count: { _all: true },
      _sum: { attempts: true },
    }),
    prisma.telegramCampaignRecipient.groupBy({
      by: ["sessionId"],
      where: { campaignId, sessionId: { not: null }, replied: true },
      _count: { _all: true },
    }),
  ]);
  const recipientCountBySession = new Map(
    sessionRecipientCounts.map((item) => [item.sessionId, item]),
  );
  const replyCountBySession = new Map(
    sessionReplyCounts.map((item) => [item.sessionId, item._count._all]),
  );
  return {
    campaign: campaignView(campaign),
    recipients: recipients.map((recipient) => ({
      ...recipient,
      telegramId: recipient.telegramId?.toString() || null,
      messageId: recipient.messageId?.toString() || null,
      replyMessageId: recipient.replyMessageId?.toString() || null,
    })),
    sessions: sessions.map((entry) => ({
      ...entry,
      recipientCount:
        recipientCountBySession.get(entry.sessionId)?._count._all || 0,
      attemptCount:
        recipientCountBySession.get(entry.sessionId)?._sum.attempts || 0,
      repliedCount: replyCountBySession.get(entry.sessionId) || 0,
    })),
    pagination: {
      page,
      pageSize,
      total: recipientCount,
      totalPages: Math.max(1, Math.ceil(recipientCount / pageSize)),
    },
  };
}

export async function cancelTelegramCampaign(
  accountId: string,
  campaignId: string,
) {
  const campaign = await prisma.telegramCampaign.findFirst({
    where: { id: campaignId, accountId },
  });
  if (!campaign)
    throw new TelegramControlError(
      "Campaign not found",
      404,
      "TELEGRAM_CAMPAIGN_NOT_FOUND",
    );
  if (!["pending", "running"].includes(campaign.status))
    return campaignView(campaign);
  return campaignView(
    await prisma.telegramCampaign.update({
      where: { id: campaignId },
      data: { cancelRequested: true },
    }),
  );
}
