import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireValidatorAdmin } from "@/lib/validator-admin-auth";
import { getValidatorCreditSettings, saveValidatorCreditSettings } from "@/lib/validator-credits";
import {
  getValidatorPlans,
  saveValidatorPlans,
  VALIDATOR_PLAN_CODES,
} from "@/lib/validator-plans";
import {
  createValidatorAccessKey,
  decryptValidatorAccessKey,
} from "@/lib/validator-auth";
import { rawKeyForPurchase } from "@/lib/validator-billing";
import { telegramTrialKey } from "@/lib/validator-trials";

const planCode = z.enum(["week", "month", "six_months", "year"]);
const planSchema = z.object({
  code: planCode,
  name: z.string().trim().min(1).max(80),
  tagline: z.string().trim().max(160),
  priceUsdCents: z.number().int().min(50).max(100_000_000),
  durationDays: z.number().int().min(1).max(36500),
  validatorAccess: z.boolean(),
  messagingAccess: z.boolean(),
  aiChatAccess: z.boolean(),
  aiCampaignLimit: z.number().int().min(0).max(100_000).nullable(),
  sessionLimit: z.number().int().min(1).max(100_000).nullable(),
  enabled: z.boolean(),
  featured: z.boolean(),
  features: z.array(z.string().trim().min(1).max(140)).max(12),
});

const actionSchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("save_plans"),
    plans: z.record(planCode, planSchema),
  }),
  z.object({
    action: z.literal("create_key"),
    email: z.string().email().max(254),
    label: z.string().trim().min(1).max(80),
    planCode,
  }),
  z.object({
    action: z.literal("rotate_key"),
    keyId: z.string().min(1),
  }),
  z.object({
    action: z.literal("revoke_key"),
    keyId: z.string().min(1),
    revoked: z.boolean(),
  }),
  z.object({
    action: z.literal("save_affiliate"),
    affiliateRateBps: z.number().int().min(0).max(10_000),
  }),
  z.object({
    action: z.literal("account"),
    accountId: z.string().min(1),
    active: z.boolean().optional(),
    extendDays: z.number().int().min(1).max(36500).optional(),
    affiliateRateBps: z.number().int().min(0).max(10_000).nullable().optional(),
  }),
  z.object({
    action: z.literal("create_update"),
    title: z.string().trim().min(1).max(160),
    body: z.string().trim().min(1).max(20_000),
    tag: z.string().trim().min(1).max(30),
    published: z.boolean(),
  }),
  z.object({
    action: z.literal("update_update"),
    id: z.string().min(1),
    title: z.string().trim().min(1).max(160),
    body: z.string().trim().min(1).max(20_000),
    tag: z.string().trim().min(1).max(30),
    published: z.boolean(),
  }),
  z.object({ action: z.literal("delete_update"), id: z.string().min(1) }),
]);

async function dashboard() {
  const now = new Date();
  const [plans, settings, accounts, purchases, updates, accountCount, activeSubscriptions] =
    await Promise.all([
      getValidatorPlans(),
      getValidatorCreditSettings(),
      prisma.validatorAccount.findMany({
        orderBy: { createdAt: "desc" },
        take: 250,
        include: {
          keys: {
            orderBy: { createdAt: "desc" },
            take: 10,
            include: {
              telegramTrial: { select: { telegramUserId: true } },
              purchases: {
                where: { purchaseType: "plan", fulfilledAt: { not: null } },
                orderBy: { createdAt: "asc" },
                take: 1,
                select: { id: true },
              },
            },
          },
          _count: {
            select: {
              referrals: true,
              lists: true,
              jobs: true,
              telegramSessions: true,
              telegramCampaigns: true,
            },
          },
          affiliateRewardsEarned: { select: { rewardDays: true } },
        },
      }),
      prisma.validatorPurchase.findMany({
        orderBy: { createdAt: "desc" },
        take: 100,
        select: {
          id: true,
          email: true,
          planName: true,
          durationDays: true,
          amountUsdCents: true,
          status: true,
          paidAt: true,
          createdAt: true,
        },
      }),
      prisma.validatorUpdate.findMany({ orderBy: { publishedAt: "desc" } }),
      prisma.validatorAccount.count(),
      prisma.validatorAccount.count({
        where: { active: true, planExpiresAt: { gt: now } },
      }),
    ]);

  return {
    plans,
    affiliateRateBps: settings.affiliateRateBps,
    totals: {
      accounts: accountCount,
      activeSubscriptions,
      expiredSubscriptions: accountCount - activeSubscriptions,
      operations: accounts.reduce(
        (sum, account) =>
          sum + account._count.jobs + account._count.telegramCampaigns,
        0,
      ),
    },
    purchases,
    updates,
    accounts: accounts.map((account) => ({
      id: account.id,
      email: account.email,
      active: account.active,
      currentPlanCode: account.currentPlanCode,
      planExpiresAt: account.planExpiresAt,
      subscriptionActive: !!account.planExpiresAt && account.planExpiresAt > now,
      referralCode: account.referralCode,
      affiliateRateBps: account.affiliateRateBps,
      referralCount: account._count.referrals,
      affiliateDays: account.affiliateRewardsEarned.reduce(
        (sum, reward) => sum + reward.rewardDays,
        0,
      ),
      listsCount: account._count.lists,
      jobsCount: account._count.jobs,
      telegramSessionsCount: account._count.telegramSessions,
      telegramCampaignsCount: account._count.telegramCampaigns,
      keys: account.keys.map((key) => ({
        id: key.id,
        label: key.label,
        prefix: key.prefix,
        rawKey:
          decryptValidatorAccessKey(key.rawKeyEncrypted) ||
          (key.telegramTrial
            ? telegramTrialKey(key.telegramTrial.telegramUserId)
            : key.purchases[0]
              ? rawKeyForPurchase(key.purchases[0].id)
              : null),
        revoked: key.revoked,
        lastUsedAt: key.lastUsedAt,
      })),
      createdAt: account.createdAt,
    })),
  };
}

export async function GET() {
  if (!(await requireValidatorAdmin()))
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  return NextResponse.json(await dashboard());
}

export async function PATCH(request: Request) {
  if (!(await requireValidatorAdmin()))
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const parsed = actionSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success)
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message || "Invalid admin action" },
      { status: 400 },
    );
  const data = parsed.data;

  if (data.action === "save_plans") {
    for (const code of VALIDATOR_PLAN_CODES)
      if (data.plans[code].code !== code)
        return NextResponse.json({ error: `Invalid ${code} plan` }, { status: 400 });
    await saveValidatorPlans(data.plans);
  } else if (data.action === "save_affiliate") {
    const settings = await getValidatorCreditSettings();
    await saveValidatorCreditSettings({
      ...settings,
      affiliateRateBps: data.affiliateRateBps,
    });
  } else if (data.action === "create_key") {
    const plans = await getValidatorPlans();
    const plan = plans[data.planCode];
    const { raw, keyHash, prefix, rawKeyEncrypted } = createValidatorAccessKey();
    const now = new Date();
    await prisma.$transaction(async (transaction) => {
      const account = await transaction.validatorAccount.upsert({
        where: { email: data.email.toLowerCase() },
        update: { active: true },
        create: { email: data.email.toLowerCase(), active: true },
      });
      const startsAt =
        account.planExpiresAt && account.planExpiresAt > now
          ? account.planExpiresAt
          : now;
      const expiresAt = new Date(startsAt.getTime() + plan.durationDays * 86_400_000);
      await transaction.validatorAccount.update({
        where: { id: account.id },
        data: { currentPlanCode: data.planCode, planExpiresAt: expiresAt },
      });
      await transaction.validatorAccessKey.create({
        data: {
          accountId: account.id,
          label: data.label,
          keyHash,
          prefix,
          rawKeyEncrypted,
          planCode: data.planCode,
          validatorAccess: true,
          messagingAccess: true,
        },
      });
    });
    return NextResponse.json({ ok: true, issuedKey: raw, ...(await dashboard()) });
  } else if (data.action === "rotate_key") {
    const { raw, keyHash, prefix, rawKeyEncrypted } = createValidatorAccessKey();
    await prisma.$transaction([
      prisma.validatorAccessKey.update({
        where: { id: data.keyId },
        data: { keyHash, prefix, rawKeyEncrypted, revoked: false },
      }),
      prisma.validatorSession.deleteMany({ where: { accessKeyId: data.keyId } }),
    ]);
    return NextResponse.json({ ok: true, issuedKey: raw, ...(await dashboard()) });
  } else if (data.action === "revoke_key") {
    await prisma.validatorAccessKey.update({
      where: { id: data.keyId },
      data: { revoked: data.revoked },
    });
    if (data.revoked)
      await prisma.validatorSession.deleteMany({ where: { accessKeyId: data.keyId } });
  } else if (data.action === "account") {
    const account = await prisma.validatorAccount.findUnique({ where: { id: data.accountId } });
    if (!account)
      return NextResponse.json({ error: "Account not found" }, { status: 404 });
    const now = new Date();
    const startsAt =
      account.planExpiresAt && account.planExpiresAt > now ? account.planExpiresAt : now;
    await prisma.validatorAccount.update({
      where: { id: data.accountId },
      data: {
        ...(data.active !== undefined ? { active: data.active } : {}),
        ...(data.affiliateRateBps !== undefined
          ? { affiliateRateBps: data.affiliateRateBps }
          : {}),
        ...(data.extendDays
          ? {
              active: true,
              planExpiresAt: new Date(startsAt.getTime() + data.extendDays * 86_400_000),
            }
          : {}),
      },
    });
  } else if (data.action === "create_update") {
    await prisma.validatorUpdate.create({
      data: {
        title: data.title,
        body: data.body,
        tag: data.tag,
        published: data.published,
      },
    });
  } else if (data.action === "update_update") {
    await prisma.validatorUpdate.update({
      where: { id: data.id },
      data: {
        title: data.title,
        body: data.body,
        tag: data.tag,
        published: data.published,
        publishedAt: data.published ? new Date() : undefined,
      },
    });
  } else {
    await prisma.validatorUpdate.delete({ where: { id: data.id } });
  }
  return NextResponse.json({ ok: true, ...(await dashboard()) });
}
