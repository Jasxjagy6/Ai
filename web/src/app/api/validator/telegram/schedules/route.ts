import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireMessagingAccount } from "@/lib/validator-auth";
import { messagingUnauthorized } from "@/lib/validator-api";
import { telegramCampaignCandidate } from "@/lib/telegram-campaigns";
import { telegramSessionSafety } from "@/lib/telegram-control";
import { runChargedValidatorTask } from "@/lib/validator-credits";

const schema = z.object({
  name: z.string().trim().min(1).max(160),
  message: z.string().min(1).max(4096),
  targetType: z.enum(["users", "groups"]).default("groups"),
  mode: z
    .enum(["balanced", "parallel", "split", "failover", "fanout"])
    .default("balanced"),
  parseMode: z.enum(["text", "markdown", "html"]).default("text"),
  sourceListId: z.string().min(1).nullable().optional(),
  sessionIds: z.array(z.string().min(1)).min(1).max(500),
  manualTargets: z
    .array(z.string().trim().min(1).max(220))
    .max(200_000)
    .default([]),
  intervalMinutes: z.number().int().min(5).max(525_600),
  nextRunAt: z.coerce.date(),
  configuration: z
    .object({
      minDelaySeconds: z.number().min(0).max(3600).default(3),
      maxDelaySeconds: z.number().min(0).max(3600).default(8),
      maxFloodWaitSeconds: z.number().int().min(0).max(86400).default(120),
      trackReplies: z.boolean().default(true),
      replyWindowHours: z.number().int().min(1).max(168).default(24),
      pacingMode: z.enum(["auto", "manual"]).default("auto"),
      perSessionBurst: z.number().int().min(1).max(500).default(5),
      cooldownSecondsMin: z.number().min(0).max(1800).default(15),
      cooldownSecondsMax: z.number().min(0).max(1800).default(30),
      perSessionQuota: z.number().int().min(1).max(200_000).default(10),
    })
    .refine(
      (value) =>
        value.maxDelaySeconds >= value.minDelaySeconds &&
        value.cooldownSecondsMax >= value.cooldownSecondsMin,
      "Maximum values must be greater than or equal to minimum values",
    )
    .default({
      minDelaySeconds: 3,
      maxDelaySeconds: 8,
      maxFloodWaitSeconds: 120,
      trackReplies: true,
      replyWindowHours: 24,
      pacingMode: "auto",
      perSessionBurst: 5,
      cooldownSecondsMin: 15,
      cooldownSecondsMax: 30,
      perSessionQuota: 10,
    }),
});

export async function GET() {
  const account = await requireMessagingAccount();
  if (!account) return messagingUnauthorized();
  const schedules = await prisma.telegramMessageSchedule.findMany({
    where: { accountId: account.id },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
  });
  return NextResponse.json({ schedules });
}

export async function POST(request: Request) {
  const account = await requireMessagingAccount();
  if (!account) return messagingUnauthorized();
  if (!account.accessKeyId)
    return NextResponse.json(
      { error: "An active messaging access key is required" },
      { status: 403 },
    );
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success)
    return NextResponse.json(
      {
        error:
          parsed.error.issues[0]?.message || "Enter valid schedule settings",
      },
      { status: 400 },
    );
  const data = parsed.data;
  if (data.targetType === "groups" && data.mode !== "fanout")
    return NextResponse.json(
      { error: "Group and channel schedules must use every-session fan-out" },
      { status: 400 },
    );
  if (data.targetType === "groups" && data.sourceListId)
    return NextResponse.json(
      { error: "Group and channel schedules require manual destinations" },
      { status: 400 },
    );
  const sessionIds = [...new Set(data.sessionIds)];
  const sessions = await prisma.telegramSession.findMany({
    where: {
      id: { in: sessionIds },
      accountId: account.id,
      status: "active",
      isLoggedIn: true,
    },
  });
  if (sessions.length !== sessionIds.length)
    return NextResponse.json(
      { error: "Select only active Telegram sessions" },
      { status: 400 },
    );
  if (
    !sessions.some((session) => telegramSessionSafety(session).massDmEligible)
  ) {
    return NextResponse.json(
      {
        error:
          "No selected sessions pass spam, health, and warmup safety checks",
        code: "NO_MASS_DM_ELIGIBLE_SESSIONS",
      },
      { status: 423 },
    );
  }
  const targetKeys = new Set<string>();
  if (data.sourceListId) {
    const list = await prisma.contactList.findFirst({
      where: { id: data.sourceListId, accountId: account.id },
      select: { id: true, itemsCount: true },
    });
    if (!list)
      return NextResponse.json(
        { error: "Source list not found" },
        { status: 404 },
      );
    if (list.itemsCount > 200_000)
      return NextResponse.json(
        { error: "Campaign lists are limited to 200,000 rows" },
        { status: 413 },
      );
    const items = await prisma.listItem.findMany({
      where: { listId: list.id },
      select: { username: true, telegramId: true },
    });
    for (const item of items) {
      const username = item.username?.replace(/^@/, "").trim();
      if (username && /^[A-Za-z][A-Za-z0-9_]{4,31}$/.test(username))
        targetKeys.add(`username:${username.toLowerCase()}`);
      else if (item.telegramId) targetKeys.add(`id:${item.telegramId}`);
    }
  }
  for (const target of data.manualTargets) {
    const candidate = telegramCampaignCandidate(target, data.targetType);
    if (candidate) targetKeys.add(candidate.targetKey);
  }
  if (!targetKeys.size)
    return NextResponse.json(
      {
        error:
          data.targetType === "groups"
            ? "Add at least one valid group or channel"
            : "Add at least one valid username or Telegram ID",
      },
      { status: 400 },
    );
  if (
    data.targetType === "users" &&
    data.mode === "fanout" &&
    targetKeys.size > 50
  )
    return NextResponse.json(
      { error: "Every-account DM schedules are limited to 50 targets" },
      { status: 400 },
    );
  const schedule = await runChargedValidatorTask(
    {
      accountId: account.id,
      accessKeyId: account.accessKeyId,
      taskCode: "schedule_create",
      items: targetKeys.size,
      sessions: sessionIds.length,
      description: `Create ${data.name} recurring schedule`,
    },
    () =>
      prisma.telegramMessageSchedule.create({
        data: {
          accountId: account.id,
          accessKeyId: account.accessKeyId,
          sourceListId: data.sourceListId || null,
          name: data.name,
          targetType: data.targetType,
          mode: data.mode,
          message: data.message,
          parseMode: data.parseMode,
          sessionIds,
          manualTargets: data.manualTargets,
          configuration: data.configuration,
          intervalMinutes: data.intervalMinutes,
          nextRunAt: data.nextRunAt,
        },
      }),
  );
  return NextResponse.json({ schedule }, { status: 201 });
}
