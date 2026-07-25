import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireValidatorAdmin } from "@/lib/validator-admin-auth";
import {
  getValidatorCreditSettings,
  saveValidatorCreditSettings,
  VALIDATOR_TASK_CODES,
} from "@/lib/validator-credits";
import {
  getValidatorPlans,
  saveValidatorPlans,
  VALIDATOR_PLAN_CODES,
} from "@/lib/validator-plans";
import { createValidatorAccessKey } from "@/lib/validator-auth";

const planCode = z.enum(["basic", "pro", "vip", "enterprise"]);
const planSchema = z.object({
  code: planCode,
  name: z.string().trim().min(1).max(80),
  tagline: z.string().trim().max(160),
  priceUsdCents: z.number().int().min(50).max(100_000_000),
  durationDays: z.number().int().min(1).max(36500).nullable(),
  creditsIncluded: z.number().int().min(0).max(1_000_000_000),
  validatorAccess: z.boolean(),
  messagingAccess: z.boolean(),
  sessionLimit: z.number().int().min(1).max(100_000).nullable(),
  enabled: z.boolean(),
  featured: z.boolean(),
  features: z.array(z.string().trim().min(1).max(140)).max(12),
});
const priceSchema = z.object({
  label: z.string().trim().min(1).max(80),
  baseCost: z.number().int().min(0).max(10_000_000),
  itemCost: z.number().int().min(0).max(10_000_000),
  itemUnit: z.number().int().min(1).max(1_000_000),
  sessionCost: z.number().int().min(0).max(10_000_000),
  enabled: z.boolean(),
});
const packSchema = z.object({
  code: z
    .string()
    .trim()
    .regex(/^[a-z0-9_]{2,40}$/),
  name: z.string().trim().min(1).max(80),
  credits: z.number().int().min(1).max(1_000_000_000),
  priceUsdCents: z.number().int().min(50).max(100_000_000),
  enabled: z.boolean(),
  featured: z.boolean(),
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
    planCode: planCode,
    expiresInDays: z.number().int().min(1).max(36500).nullable(),
    credits: z.number().int().min(0).max(1_000_000_000),
    validatorAccess: z.boolean(),
    messagingAccess: z.boolean(),
    sessionLimit: z.number().int().min(1).max(100_000).nullable(),
  }),
  z.object({
    action: z.literal("revoke_key"),
    keyId: z.string().min(1),
    revoked: z.boolean(),
  }),
  z.object({
    action: z.literal("save_credits"),
    settings: z.object({
      creditsPerUsd: z.number().int().min(1).max(1_000_000),
      affiliateRateBps: z.number().int().min(0).max(10_000),
      tasks: z.record(z.enum(VALIDATOR_TASK_CODES), priceSchema),
      topups: z.array(packSchema).min(1).max(20),
    }),
  }),
  z.object({
    action: z.literal("account"),
    accountId: z.string().min(1),
    active: z.boolean().optional(),
    creditAdjustment: z
      .number()
      .int()
      .min(-1_000_000_000)
      .max(1_000_000_000)
      .optional(),
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
  const [plans, creditSettings, accounts, purchases, updates, totals] =
    await Promise.all([
      getValidatorPlans(),
      getValidatorCreditSettings(),
      prisma.validatorAccount.findMany({
        orderBy: { createdAt: "desc" },
        take: 250,
        include: {
          keys: { orderBy: { createdAt: "desc" }, take: 10 },
          _count: {
            select: {
              referrals: true,
              lists: true,
              jobs: true,
              telegramSessions: true,
              telegramCampaigns: true,
            },
          },
          affiliateRewardsEarned: {
            select: { rewardCredits: true },
          },
        },
      }),
      prisma.validatorPurchase.findMany({
        orderBy: { createdAt: "desc" },
        take: 100,
        select: {
          id: true,
          email: true,
          planName: true,
          purchaseType: true,
          creditsAmount: true,
          amountUsdCents: true,
          status: true,
          paidAt: true,
          createdAt: true,
        },
      }),
      prisma.validatorUpdate.findMany({ orderBy: { publishedAt: "desc" } }),
      prisma.validatorAccount.aggregate({
        _sum: {
          creditsBalance: true,
          creditsPurchased: true,
          creditsSpent: true,
        },
        _count: true,
      }),
    ]);
  return {
    plans,
    creditSettings,
    totals,
    purchases,
    updates,
    accounts: accounts.map((account) => ({
      id: account.id,
      email: account.email,
      active: account.active,
      creditsBalance: account.creditsBalance,
      creditsPurchased: account.creditsPurchased,
      creditsSpent: account.creditsSpent,
      currentPlanCode: account.currentPlanCode,
      planExpiresAt: account.planExpiresAt,
      referralCode: account.referralCode,
      affiliateRateBps: account.affiliateRateBps,
      referralCount: account._count.referrals,
      affiliateCredits: account.affiliateRewardsEarned.reduce(
        (sum, reward) => sum + reward.rewardCredits,
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
        revoked: key.revoked,
        expiresAt: key.expiresAt,
        lastUsedAt: key.lastUsedAt,
        validatorAccess: key.validatorAccess,
        messagingAccess: key.messagingAccess,
        sessionLimit: key.sessionLimit,
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
    for (const code of VALIDATOR_PLAN_CODES) {
      if (data.plans[code].code !== code)
        return NextResponse.json(
          { error: `Invalid ${code} plan` },
          { status: 400 },
        );
      if (
        !data.plans[code].validatorAccess &&
        !data.plans[code].messagingAccess
      )
        return NextResponse.json(
          { error: `${code} must enable a product` },
          { status: 400 },
        );
    }
    await saveValidatorPlans(data.plans);
  } else if (data.action === "save_credits") {
    const codes = new Set(data.settings.topups.map((pack) => pack.code));
    if (codes.size !== data.settings.topups.length)
      return NextResponse.json(
        { error: "Credit pack codes must be unique" },
        { status: 400 },
      );
    await saveValidatorCreditSettings(data.settings);
  } else if (data.action === "create_key") {
    if (!data.validatorAccess && !data.messagingAccess)
      return NextResponse.json(
        { error: "Enable at least one product" },
        { status: 400 },
      );
    const { raw, keyHash, prefix } = createValidatorAccessKey();
    const email = data.email.toLowerCase();
    const expiresAt = data.expiresInDays
      ? new Date(Date.now() + data.expiresInDays * 24 * 60 * 60 * 1000)
      : null;
    await prisma.$transaction(async (transaction) => {
      const account = await transaction.validatorAccount.upsert({
        where: { email },
        update: {
          active: true,
          currentPlanCode: data.planCode,
          planExpiresAt: expiresAt,
          ...(data.credits
            ? {
                creditsBalance: { increment: data.credits },
                creditsPurchased: { increment: data.credits },
                lastCreditTopupAt: new Date(),
              }
            : {}),
        },
        create: {
          email,
          currentPlanCode: data.planCode,
          planExpiresAt: expiresAt,
          creditsBalance: data.credits,
          creditsPurchased: data.credits,
          lastCreditTopupAt: data.credits ? new Date() : null,
        },
      });
      const key = await transaction.validatorAccessKey.create({
        data: {
          accountId: account.id,
          label: data.label,
          keyHash,
          prefix,
          expiresAt,
          planCode: data.planCode,
          validatorAccess: data.validatorAccess,
          messagingAccess: data.messagingAccess,
          sessionLimit: data.sessionLimit,
        },
      });
      if (data.credits) {
        await transaction.validatorCreditTransaction.create({
          data: {
            accountId: account.id,
            accessKeyId: key.id,
            amount: data.credits,
            balanceAfter: account.creditsBalance,
            kind: "admin_grant",
            description: `${data.label} included credits`,
          },
        });
      }
    });
    return NextResponse.json({
      ok: true,
      issuedKey: raw,
      ...(await dashboard()),
    });
  } else if (data.action === "revoke_key") {
    await prisma.validatorAccessKey.update({
      where: { id: data.keyId },
      data: { revoked: data.revoked },
    });
    if (data.revoked)
      await prisma.validatorSession.deleteMany({
        where: { accessKeyId: data.keyId },
      });
  } else if (data.action === "account") {
    const account = await prisma.validatorAccount.findUnique({
      where: { id: data.accountId },
    });
    if (!account)
      return NextResponse.json({ error: "Account not found" }, { status: 404 });
    const adjustment = data.creditAdjustment || 0;
    if (account.creditsBalance + adjustment < 0)
      return NextResponse.json(
        { error: "Adjustment would make the balance negative" },
        { status: 400 },
      );
    await prisma.$transaction(async (transaction) => {
      const updated = await transaction.validatorAccount.update({
        where: { id: data.accountId },
        data: {
          ...(data.active !== undefined ? { active: data.active } : {}),
          ...(data.affiliateRateBps !== undefined
            ? { affiliateRateBps: data.affiliateRateBps }
            : {}),
          ...(adjustment
            ? {
                creditsBalance: { increment: adjustment },
                creditsPurchased:
                  adjustment > 0 ? { increment: adjustment } : undefined,
              }
            : {}),
        },
      });
      if (adjustment) {
        await transaction.validatorCreditTransaction.create({
          data: {
            accountId: data.accountId,
            amount: adjustment,
            balanceAfter: updated.creditsBalance,
            kind: "admin_adjustment",
            description: "Validator admin balance adjustment",
          },
        });
      }
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
