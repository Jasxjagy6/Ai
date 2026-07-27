import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSignalDeskAccount } from "@/lib/validator-auth";
import { getValidatorCreditSettings } from "@/lib/validator-credits";
import { unauthorized } from "@/lib/validator-api";

export async function GET() {
  const account = await requireSignalDeskAccount();
  if (!account) return unauthorized();
  const [transactions, rewards, referrals, updates, creditSettings] =
    await Promise.all([
      prisma.validatorCreditTransaction.findMany({
        where: { accountId: account.id },
        orderBy: { createdAt: "desc" },
        take: 100,
      }),
      prisma.validatorAffiliateReward.findMany({
        where: { referrerId: account.id },
        orderBy: { createdAt: "desc" },
        take: 100,
        include: {
          referredAccount: { select: { email: true } },
        },
      }),
      prisma.validatorAccount.findMany({
        where: { referredById: account.id },
        orderBy: { createdAt: "desc" },
        take: 100,
        select: {
          id: true,
          email: true,
          createdAt: true,
          currentPlanCode: true,
        },
      }),
      prisma.validatorUpdate.findMany({
        where: { published: true },
        orderBy: { publishedAt: "desc" },
        take: 50,
      }),
      getValidatorCreditSettings(),
    ]);
  return NextResponse.json({
    account,
    transactions,
    rewards: rewards.map((reward) => ({
      ...reward,
      referredAccount: {
        email: reward.referredAccount.email.replace(
          /^(.{1,2}).*(@.*)$/,
          "$1***$2",
        ),
      },
    })),
    referrals,
    updates,
    creditSettings,
  });
}
